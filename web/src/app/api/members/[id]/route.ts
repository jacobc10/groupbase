import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchIntegrationEvent } from '@/lib/integrations/dispatcher'

// GET /api/members/[id] â get single member with activity log
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

  // Get pipeline stage info for this member
  const { data: pipelineMember } = await supabase
    .from('pipeline_members')
    .select('id, stage_id, pipeline_id, stage:pipeline_stages(id, name, color, status_mapping), pipeline:pipelines(id, name)')
    .eq('member_id', id)
    .limit(1)
    .maybeSingle()

  let pipelineStage = null
  let pipelineStages: { id: string; name: string; color: string; status_mapping: string; position: number }[] = []

  if (pipelineMember) {
    const stage = pipelineMember.stage as unknown as { id: string; name: string; color: string; status_mapping: string } | null
    const pipeline = pipelineMember.pipeline as unknown as { id: string; name: string } | null
    if (stage && pipeline) {
      pipelineStage = {
        stage_id: stage.id,
        stage_name: stage.name,
        stage_color: stage.color,
        pipeline_id: pipeline.id,
        pipeline_name: pipeline.name,
        pipeline_member_id: pipelineMember.id,
      }

      // Also fetch all stages for this pipeline (for the dropdown)
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, status_mapping, position')
        .eq('pipeline_id', pipeline.id)
        .order('position', { ascending: true })

      pipelineStages = stages || []
    }
  }

  return NextResponse.json({
    member,
    activities: activities || [],
    pipelineStage,
    pipelineStages,
  })
}

// PATCH /api/members/[id] â update a member
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

  // Handle pipeline stage change if pipeline_stage_id is provided
  if (body.pipeline_stage_id) {
    // Find the member's pipeline_members entry
    const { data: pmEntry } = await supabase
      .from('pipeline_members')
      .select('id, pipeline_id')
      .eq('member_id', id)
      .limit(1)
      .maybeSingle()

    if (pmEntry) {
      // Update the stage â DB trigger will sync the member status
      await supabase
        .from('pipeline_members')
        .update({
          stage_id: body.pipeline_stage_id,
          moved_at: new Date().toISOString(),
          position: 0,
        })
        .eq('id', pmEntry.id)

      // Log pipeline stage change
      await supabase.from('activity_log').insert({
        member_id: id,
        group_id: existing.group_id,
        action: 'pipeline_stage_changed',
        details: { pipeline_id: pmEntry.pipeline_id, to_stage_id: body.pipeline_stage_id },
        performed_by: user.id,
      })

      // Re-fetch member to get the synced status
      const { data: refreshedMember } = await supabase
        .from('members')
        .select('*, group:groups!inner(id, name, fb_group_url)')
        .eq('id', id)
        .single()

      if (refreshedMember) {
        return NextResponse.json({ member: refreshedMember })
      }
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

// DELETE /api/members/[id] â delete a member
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
