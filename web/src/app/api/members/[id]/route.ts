import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchIntegrationEvent } from '@/lib/integrations/dispatcher'

// GET /api/members/[id] — get single member with activity log
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: member, error } = await supabase
    .from('members')
    .select('*, group:groups!inner(id, name, fb_group_url)')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  // Get activity log for this member
  const { data: activities } = await supabase
    .from('activity_log')
    .select('*')
    .eq('member_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ member, activities: activities || [] })
}

// PATCH /api/members/[id] — update a member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Get existing member to detect changes
  const { data: existing } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Build update object from allowed fields
  const allowedFields = ['name', 'email', 'phone', 'status', 'tags', 'notes', 'assigned_to']
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  const { data: member, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select('*, group:groups!inner(id, name, fb_group_url)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log relevant activity
  if (body.status && body.status !== existing.status) {
    await supabase.from('activity_log').insert({
      member_id: id,
      group_id: existing.group_id,
      action: 'status_changed',
      details: { from: existing.status, to: body.status },
      performed_by: user.id,
    })
  }

  if (body.notes && body.notes !== existing.notes) {
    await supabase.from('activity_log').insert({
      member_id: id,
      group_id: existing.group_id,
      action: 'note_added',
      details: { note: body.notes },
      performed_by: user.id,
    })
  }

  if (body.tags && JSON.stringify(body.tags) !== JSON.stringify(existing.tags)) {
    const added = body.tags.filter((t: string) => !existing.tags.includes(t))
    const removed = existing.tags.filter((t: string) => !body.tags.includes(t))
    if (added.length > 0) {
      await supabase.from('activity_log').insert({
        member_id: id,
        group_id: existing.group_id,
        action: 'tag_added',
        details: { tags: added },
        performed_by: user.id,
      })
    }
    if (removed.length > 0) {
      await supabase.from('activity_log').insert({
        member_id: id,
        group_id: existing.group_id,
        action: 'tag_removed',
        details: { tags: removed },
        performed_by: user.id,
      })
    }
  }

  // Fire integration events (non-blocking)
  const integrationEvent = body.status && body.status !== existing.status
    ? 'member.status_changed' as const
    : 'member.updated' as const

  dispatchIntegrationEvent(integrationEvent, {
    id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    fb_profile_url: member.fb_profile_url,
    tags: member.tags,
    status: member.status,
    group_id: existing.group_id,
  }, user.id).catch((err) => console.error('Integration dispatch error:', err))

  return NextResponse.json({ member })
}

// DELETE /api/members/[id] — delete a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Get member info before deleting
  const { data: existing } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log activity
  await supabase.from('activity_log').insert({
    member_id: null,
    group_id: existing.group_id,
    action: 'member_deleted',
    details: { name: existing.name, email: existing.email },
    performed_by: user.id,
  })

  return NextResponse.json({ success: true })
}
