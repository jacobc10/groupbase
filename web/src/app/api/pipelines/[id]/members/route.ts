import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pipelines/[id]/members — add member(s) to pipeline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: pipelineId } = await params
  const body = await request.json()

  // body: { member_ids: string[], stage_id: string }
  if (!body.member_ids || !body.stage_id) {
    return NextResponse.json({ error: 'member_ids and stage_id required' }, { status: 400 })
  }

  // Get current max position in the target stage
  const { data: maxMember } = await supabase
    .from('pipeline_members')
    .select('position')
    .eq('stage_id', body.stage_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  let nextPosition = (maxMember?.position ?? -1) + 1

  const inserts = body.member_ids.map((memberId: string) => ({
    pipeline_id: pipelineId,
    stage_id: body.stage_id,
    member_id: memberId,
    position: nextPosition++,
  }))

  const { data: pipelineMembers, error } = await supabase
    .from('pipeline_members')
    .upsert(inserts, { onConflict: 'pipeline_id,member_id' })
    .select('*, member:members(id, name, email, status, tags, group_id, fb_profile_url, fb_user_id, group:groups(id, name))')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-sync: if the target stage has a status_mapping, update member status
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('status_mapping')
    .eq('id', body.stage_id)
    .single()

  if (stage?.status_mapping) {
    for (const memberId of body.member_ids) {
      // Get existing member status
      const { data: existing } = await supabase
        .from('members')
        .select('status, group_id')
        .eq('id', memberId)
        .single()

      if (existing && existing.status !== stage.status_mapping) {
        await supabase
          .from('members')
          .update({ status: stage.status_mapping })
          .eq('id', memberId)

        // Log activity
        await supabase.from('activity_log').insert({
          member_id: memberId,
          group_id: existing.group_id,
          action: 'pipeline_stage_changed',
          details: {
            pipeline_id: pipelineId,
            stage_id: body.stage_id,
            status_from: existing.status,
            status_to: stage.status_mapping,
          },
          performed_by: user.id,
        })
      }
    }
  }

  return NextResponse.json({ pipeline_members: pipelineMembers }, { status: 201 })
}

// PATCH /api/pipelines/[id]/members — move a member to a different stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: pipelineId } = await params
  const body = await request.json()

  // body: { member_id: string, stage_id: string, position?: number }
  if (!body.member_id || !body.stage_id) {
    return NextResponse.json({ error: 'member_id and stage_id required' }, { status: 400 })
  }

  // Get current max position in target stage if not provided
  let position = body.position
  if (position === undefined) {
    const { data: maxMember } = await supabase
      .from('pipeline_members')
      .select('position')
      .eq('stage_id', body.stage_id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    position = (maxMember?.position ?? -1) + 1
  }

  const { data: pipelineMember, error } = await supabase
    .from('pipeline_members')
    .update({
      stage_id: body.stage_id,
      position,
      moved_at: new Date().toISOString(),
    })
    .eq('pipeline_id', pipelineId)
    .eq('member_id', body.member_id)
    .select('*, member:members(id, name, email, status, tags, group_id, fb_profile_url, fb_user_id, group:groups(id, name))')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-sync: update member status based on target stage's status_mapping
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('status_mapping, name')
    .eq('id', body.stage_id)
    .single()

  if (stage?.status_mapping) {
    const { data: existing } = await supabase
      .from('members')
      .select('status, group_id')
      .eq('id', body.member_id)
      .single()

    if (existing && existing.status !== stage.status_mapping) {
      await supabase
        .from('members')
        .update({ status: stage.status_mapping })
        .eq('id', body.member_id)

      // Log activity
      await supabase.from('activity_log').insert({
        member_id: body.member_id,
        group_id: existing.group_id,
        action: 'pipeline_stage_changed',
        details: {
          pipeline_id: pipelineId,
          stage_name: stage.name,
          stage_id: body.stage_id,
          status_from: existing.status,
          status_to: stage.status_mapping,
        },
        performed_by: user.id,
      })
    }
  }

  return NextResponse.json({ pipeline_member: pipelineMember })
}

// DELETE /api/pipelines/[id]/members — remove member from pipeline
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: pipelineId } = await params
  const body = await request.json()

  if (!body.member_id) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('pipeline_members')
    .delete()
    .eq('pipeline_id', pipelineId)
    .eq('member_id', body.member_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
