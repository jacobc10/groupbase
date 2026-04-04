import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/pipelines/[id] — get pipeline with stages and members
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

  // Get pipeline
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  // Get stages ordered by position
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', id)
    .order('position', { ascending: true })

  // Get all pipeline members with their member data
  const { data: pipelineMembers } = await supabase
    .from('pipeline_members')
    .select('*, member:members(id, name, email, fb_profile_url, fb_user_id, status, tags, group_id, created_at, group:groups(id, name))')
    .eq('pipeline_id', id)
    .order('position', { ascending: true })

  // Group members by stage
  const stagesWithMembers = (stages || []).map(stage => ({
    ...stage,
    pipeline_members: (pipelineMembers || []).filter(pm => pm.stage_id === stage.id)
  }))

  return NextResponse.json({
    pipeline: { ...pipeline, stages: stagesWithMembers }
  })
}

// PATCH /api/pipelines/[id] — update pipeline name/description
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

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description

  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .update(updates)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pipeline })
}

// DELETE /api/pipelines/[id] — delete a pipeline
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

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
