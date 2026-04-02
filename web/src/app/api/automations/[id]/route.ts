import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/automations/[id] — update automation
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

  // Get the automation to verify ownership
  const { data: automation, error: getError } = await supabase
    .from('integrations')
    .select('*, group:groups!inner(owner_id)')
    .eq('id', id)
    .eq('type', 'automation')
    .single()

  if (getError || !automation) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  // Verify user owns the group
  if (automation.group.owner_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Prepare update payload
  const updateData: any = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.active !== undefined) updateData.active = body.active

  if (body.trigger !== undefined || body.actions !== undefined) {
    const config = automation.config as any
    updateData.config = {
      trigger: body.trigger ?? config.trigger,
      actions: body.actions ?? config.actions,
    }
  }

  updateData.updated_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('integrations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log activity
  await supabase.from('activity_log').insert({
    group_id: automation.group_id,
    action: 'automation_updated',
    details: { automation_id: id, changes: Object.keys(updateData) },
    performed_by: user.id,
  })

  return NextResponse.json({
    automation: {
      id: updated.id,
      group_id: updated.group_id,
      name: updated.name,
      trigger: (updated.config as any).trigger,
      active: updated.active,
      actions: (updated.config as any).actions || [],
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  })
}

// DELETE /api/automations/[id] — delete automation
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

  // Get the automation to verify ownership
  const { data: automation, error: getError } = await supabase
    .from('integrations')
    .select('*, group:groups!inner(owner_id)')
    .eq('id', id)
    .eq('type', 'automation')
    .single()

  if (getError || !automation) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  // Verify user owns the group
  if (automation.group.owner_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.from('integrations').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log activity
  await supabase.from('activity_log').insert({
    group_id: automation.group_id,
    action: 'automation_deleted',
    details: { automation_id: id, name: automation.name },
    performed_by: user.id,
  })

  return NextResponse.json({ success: true })
}
