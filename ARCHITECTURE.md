# GroupBase — Architecture & Build Plan

## Overview
GroupBase is a SaaS CRM platform for Facebook Group owners. It consists of a Chrome extension that captures member data when group admins approve join requests, and a web dashboard for managing members as leads.

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes (serverless on Vercel)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Chrome Extension**: Manifest V3 (content script + popup + service worker)
- **Hosting**: Vercel (web app) + Chrome Web Store (extension)
- **Payments**: Stripe (subscription billing)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Content Script│  │   Popup UI   │  │   Service Worker      │ │
│  │ (Facebook DOM)│  │ (Quick view) │  │ (Background tasks)    │ │
│  │              │──▶│              │──▶│                       │ │
│  │ - Detect     │  │ - Auth status│  │ - Supabase API calls  │ │
│  │   member req │  │ - Group list │  │ - Sync member data    │ │
│  │ - Scrape data│  │ - Quick stats│  │ - Handle auth tokens  │ │
│  │ - Inject UI  │  │              │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (Supabase REST API)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Backend)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Auth   │  │ Database │  │ Storage  │  │  Edge Funcs  │   │
│  │ (Users)  │  │ (Postgres)│  │ (Photos) │  │ (Webhooks)   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WEB DASHBOARD (Next.js on Vercel)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │Dashboard │  │ Members  │  │  Groups  │  │  Settings    │   │
│  │ (Stats)  │  │ (CRM)    │  │ (Manage) │  │ (Billing)    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

**profiles** (extends Supabase auth.users)
- id (uuid, FK → auth.users)
- full_name, email, avatar_url
- plan (free | pro | enterprise)
- stripe_customer_id
- created_at, updated_at

**teams**
- id, name, owner_id (FK → profiles)
- created_at

**team_members**
- team_id, user_id, role (owner | admin | member)

**groups**
- id, fb_group_id (unique), name, member_count
- owner_id (FK → profiles), team_id (FK → teams)
- created_at, updated_at

**members**
- id, group_id (FK → groups)
- fb_user_id, fb_profile_url, name, email, phone
- answers (jsonb — membership question answers)
- tags (text[])
- status (new | contacted | qualified | converted | archived)
- assigned_to (FK → profiles)
- notes (text)
- approved_at, created_at, updated_at

**integrations**
- id, group_id (FK → groups)
- type (webhook | gohighlevel | mailchimp | zapier)
- config (jsonb — encrypted)
- active (boolean)
- created_at

**activity_log**
- id, member_id (FK → members)
- action (approved | emailed | tagged | note_added | status_changed)
- details (jsonb)
- performed_by (FK → profiles)
- created_at

## Chrome Extension — How It Works

### 1. Content Script (facebook-content.js)
Injected on `facebook.com/groups/*/member-requests`:
- Detects when admin clicks "Approve" on a member request
- Scrapes visible data: name, profile URL, answers to membership questions
- Sends data to the service worker

### 2. Service Worker (background.js)
- Receives member data from content script
- Authenticates with Supabase using stored tokens
- POSTs member data to Supabase database
- Triggers any configured integrations (webhooks, email lists)

### 3. Popup (popup.html)
- Shows login/signup if not authenticated
- Shows connected groups and quick stats
- Link to full web dashboard

## Build Phases

### Phase 1 — MVP ✅
- [x] Project scaffolding (Next.js + Supabase)
- [x] Database schema (with RLS policies + SECURITY DEFINER function)
- [x] Auth (signup/login/logout with middleware redirects)
- [x] Chrome extension skeleton
- [x] Basic dashboard layout

### Phase 2 — Core CRM ✅
- [x] Members list page with search/filter/sort (UI ready, wired to Supabase)
- [x] Member detail view with notes & status
- [x] Groups management page
- [x] Integrations page
- [x] CSV export/import API routes
- [x] All API routes wired to Supabase (groups, members, members/[id], export, import)
- [x] RLS policies fixed (SECURITY DEFINER function to prevent infinite recursion)
- [ ] Chrome extension content script (Facebook DOM scraping) — moved to Phase 3
- [ ] Member approval detection & data capture — moved to Phase 3
- [ ] Tags and bulk actions — moved to Phase 3

### Phase 3 — Chrome Extension & Data Capture ✅
- [x] Wire up Chrome extension content script to actually scrape Facebook member request data
- [x] Member approval detection (detect "Approve" click on facebook.com/groups/*/member-requests)
- [x] Auto-capture member data (name, profile URL, question answers) on approval
- [x] Persistent status banner and capture counter in content script
- [x] Extension popup auth flow (login via Supabase from extension popup)
- [x] Service worker → Supabase sync (POST captured members to database, queue + retry)
- [x] Tags and bulk actions on members list (bulk status, bulk tag, bulk delete, tag filter)
- [ ] Test end-to-end: approve member on Facebook → appears in GroupBase dashboard

### Phase 4 — Integrations ✅
- [x] Webhook integrations (HMAC-signed, retry logic)
- [x] GoHighLevel API integration (contact sync)
- [x] Mailchimp audience sync (with tags)
- [x] Zapier webhook support
- [x] Integration CRUD API with plan-based limits
- [x] Event dispatcher (fires on member create/update/status change)
- [x] Data-driven integrations page with add/test/pause/delete

### Phase 5 — Stripe Billing ✅
- [x] Stripe products & prices created (Pro $47/mo, Enterprise $97/mo)
- [x] Stripe checkout session API route
- [x] Stripe customer portal API route
- [x] Stripe webhook handler (subscription lifecycle)
- [x] Plan-based usage limits (groups, members, CSV export)
- [x] Settings page with plan cards and upgrade/downgrade
- [x] Public pricing page
- [x] Team management (invite members, roles, plan-based seat limits)
- [x] Multi-group management (group CRUD, member assignment)

### Phase 6 — Advanced ✅
- [x] Autoresponder / Automations (rule engine with add_tag, set_status, send_email, webhook actions)
- [x] Analytics dashboard (growth charts, status funnel, tags, activity feed)
- [x] Email outreach (compose, send via Resend, template variables, bulk send)
- [x] Chrome extension popup with quick actions (search, status summary, recent captures, quick tag)
- [x] API for third-party integrations (API key auth, /api/v1/members, /api/v1/groups)
