import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkMemberLimit } from '@/lib/plan-limits'
import { dispatchIntegrationEvent } from '@/lib/integrations/dispatcher'
import { executeAutomations } from '@/lib/automations/engine'

// GET /api/members — list members with search, filter, sort, pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || 'all'
  const groupId = searchParams.get('group_id') || ''
  const tag = searchParams.get('tag') || ''
  const sortBy = searchParams.get('sort_by') || 'created_at'
  const sortDir = searchParams.get('sort_dir') === 'asc' ? true : false
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = (page - 1) * limit

  // Build query — select members from user's groups, join group name
  let query = supabase
    .from('members')
    .select('*, group:groups!inner(id, name, fb_group_url)', { count: 'exact' })

  // Only members from groups the user owns
  // RLS handles this, but let's be explicit
  if (groupId) {
    query = query.eq('group_id', groupId)
  }

  // Status filter
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  // Tag filter
  if (tag) {
    query = query.contains('tags', [tag])
  }

  // Search by name or email
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  // Sort
  const validSortColumns = ['created_at', 'name', 'email', 'status', 'approved_at', 'updated_at']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
  query = query.order(sortColumn, { ascending: sortDir })

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const { data: members, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    members: members || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}

// POST /api/members — create a new member
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Check plan limits
  if (body.group_id) {
    const memberLimit = await checkMemberLimit(user.id, body.group_id)
    if (!memberLimit.allowed) {
      return NextResponse.json(
        {
          error: `Member limit reached (${memberLimit.current}/${memberLimit.limit}). Upgrade your plan for unlimited members.`,
          code: 'PLAN_LIMIT_REACHED',
          current: memberLimit.current,
          limit: memberLimit.limit,
        },
        { status: 403 }
      )
    }
  }

  const { data: member, error } = await supabase
    .from('members')
    .insert({
      group_id: body.group_id,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      fb_user_id: body.fb_user_id || null,
      fb_profile_url: body.fb_profile_url || null,
      answers: body.answers || [],
      tags: body.tags || [],
      status: body.status || 'new',
      notes: body.notes || null,
      approved_at: body.approved_at || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log activity
  await supabase.from('activity_log').insert({
    member_id: member.id,
    group_id: body.group_id,
    action: 'member_approved',
    details: { source: body.source || 'manual' },
    performed_by: user.id,
  })

  // Fire integration events (non-blocking)
  dispatchIntegrationEvent('member.created', {
    id: member.id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    fb_profile_url: member.fb_profile_url,
    tags: member.tags,
    status: member.status,
    group_id: body.group_id,
    group_name: body.group_name,
    answers: member.answers,
  }, user.id).catch((err) => console.error('Integration dispatch error:', err))

  // Fire automations (non-blocking)
  executeAutomations('member.created', {
    id: member.id,
    name: member.name,
    email: member.email,
    group_id: body.group_id,
    group_name: body.group_name,
    tags: member.tags,
    status: member.status,
  }, user.id, body.group_id).catch((err) => console.error('Automation error:', err))

  return NextResponse.json({ member }, { status: 201 })
}
