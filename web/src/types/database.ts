export type MemberStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'archived'
export type IntegrationType = 'webhook' | 'gohighlevel' | 'mailchimp' | 'zapier'
export type ActivityAction =
  | 'member_approved'
  | 'status_changed'
  | 'tag_added'
  | 'tag_removed'
  | 'note_added'
  | 'assigned'
  | 'exported'
  | 'integration_synced'
  | 'email_sent'
  | 'member_deleted'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  plan: 'free' | 'pro' | 'enterprise'
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

export interface Group {
  id: string
  fb_group_id: string | null
  name: string
  fb_group_url: string | null
  member_count: number
  owner_id: string
  team_id: string | null
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  group_id: string
  fb_user_id: string | null
  fb_profile_url: string | null
  name: string
  email: string | null
  phone: string | null
  answers: Record<string, string>[] | string[]
  tags: string[]
  status: MemberStatus
  assigned_to: string | null
  notes: string | null
  approved_at: string
  created_at: string
  updated_at: string
  // Joined data
  group?: Group
}

export interface Integration {
  id: string
  group_id: string
  type: IntegrationType
  config: Record<string, unknown>
  active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  member_id: string | null
  group_id: string | null
  action: ActivityAction
  details: Record<string, unknown>
  performed_by: string | null
  created_at: string
}
