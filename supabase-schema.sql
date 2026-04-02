-- ============================================
-- GroupBase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  avatar_url text,
  plan text default 'free' check (plan in ('free', 'pro', 'enterprise')),
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- TEAMS
-- ============================================
create table public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

-- ============================================
-- GROUPS (Facebook groups)
-- ============================================
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  fb_group_id text unique,
  name text not null,
  fb_group_url text,
  member_count integer default 0,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- MEMBERS (captured from Facebook groups)
-- ============================================
create table public.members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  fb_user_id text,
  fb_profile_url text,
  name text not null,
  email text,
  phone text,
  answers jsonb default '[]'::jsonb,
  tags text[] default '{}',
  status text default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'archived')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  approved_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookups
create index idx_members_group_id on public.members(group_id);
create index idx_members_status on public.members(status);
create index idx_members_email on public.members(email);
create index idx_members_fb_user_id on public.members(fb_user_id);
create index idx_members_created_at on public.members(created_at desc);

-- ============================================
-- INTEGRATIONS
-- ============================================
create table public.integrations (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  type text not null check (type in ('webhook', 'gohighlevel', 'mailchimp', 'zapier')),
  config jsonb default '{}'::jsonb,
  active boolean default false,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- ACTIVITY LOG
-- ============================================
create table public.activity_log (
  id uuid default uuid_generate_v4() primary key,
  member_id uuid references public.members(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  action text not null check (action in (
    'member_approved', 'status_changed', 'tag_added', 'tag_removed',
    'note_added', 'assigned', 'exported', 'integration_synced',
    'email_sent', 'member_deleted'
  )),
  details jsonb default '{}'::jsonb,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_activity_log_member on public.activity_log(member_id);
create index idx_activity_log_group on public.activity_log(group_id);
create index idx_activity_log_created on public.activity_log(created_at desc);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.integrations enable row level security;
alter table public.activity_log enable row level security;

-- ============================================
-- SECURITY DEFINER FUNCTION (bypasses RLS to prevent infinite recursion)
-- ============================================
create or replace function public.get_user_team_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select team_id from public.team_members where user_id = p_user_id;
$$;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Teams: owners and members can access
create policy "Users can view their teams"
  on public.teams for select
  using (
    owner_id = auth.uid()
    or id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Users can create teams"
  on public.teams for insert
  with check (owner_id = auth.uid());

-- Team members: simplified policy to prevent recursion
create policy "Team members can view memberships"
  on public.team_members for select
  using (user_id = auth.uid());

-- Groups: owners and team members can access (uses SECURITY DEFINER function)
create policy "Users can view own groups"
  on public.groups for select
  using (
    owner_id = auth.uid()
    or team_id in (select public.get_user_team_ids(auth.uid()))
  );

create policy "Users can create groups"
  on public.groups for insert
  with check (owner_id = auth.uid());

create policy "Owners can update groups"
  on public.groups for update
  using (owner_id = auth.uid());

create policy "Owners can delete groups"
  on public.groups for delete
  using (owner_id = auth.uid());

-- Members: accessible by group owner and team members
create policy "Users can view members of their groups"
  on public.members for select
  using (
    group_id in (
      select id from public.groups
      where owner_id = auth.uid()
      or team_id in (select public.get_user_team_ids(auth.uid()))
    )
  );

create policy "Users can insert members to their groups"
  on public.members for insert
  with check (
    group_id in (
      select id from public.groups
      where owner_id = auth.uid()
      or team_id in (select public.get_user_team_ids(auth.uid()))
    )
  );

create policy "Users can update members of their groups"
  on public.members for update
  using (
    group_id in (
      select id from public.groups
      where owner_id = auth.uid()
      or team_id in (select public.get_user_team_ids(auth.uid()))
    )
  );

create policy "Users can delete members of their groups"
  on public.members for delete
  using (
    group_id in (
      select id from public.groups where owner_id = auth.uid()
    )
  );

-- Integrations: accessible by group owner
create policy "Users can manage integrations for their groups"
  on public.integrations for all
  using (
    group_id in (
      select id from public.groups where owner_id = auth.uid()
    )
  );

-- Activity Log: viewable by group owner and team
create policy "Users can view activity for their groups"
  on public.activity_log for select
  using (
    group_id in (
      select id from public.groups
      where owner_id = auth.uid()
      or team_id in (select public.get_user_team_ids(auth.uid()))
    )
  );

create policy "Users can insert activity for their groups"
  on public.activity_log for insert
  with check (
    group_id in (
      select id from public.groups
      where owner_id = auth.uid()
      or team_id in (select public.get_user_team_ids(auth.uid()))
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_groups_updated_at
  before update on public.groups
  for each row execute function public.update_updated_at();

create trigger update_members_updated_at
  before update on public.members
  for each row execute function public.update_updated_at();

create trigger update_integrations_updated_at
  before update on public.integrations
  for each row execute function public.update_updated_at();

-- Function to increment group member count
create or replace function public.increment_group_member_count()
returns trigger as $$
begin
  update public.groups
  set member_count = member_count + 1
  where id = new.group_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_member_added
  after insert on public.members
  for each row execute function public.increment_group_member_count();

-- Function to decrement group member count
create or replace function public.decrement_group_member_count()
returns trigger as $$
begin
  update public.groups
  set member_count = greatest(0, member_count - 1)
  where id = old.group_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_member_removed
  after delete on public.members
  for each row execute function public.decrement_group_member_count();
