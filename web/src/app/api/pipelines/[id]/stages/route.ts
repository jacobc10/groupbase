import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pipelines/[id]/stages — add a stage to a pipeline
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

  // Get max position
  const { data: maxStage } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxStage?.position ?? -1) + 1

  const { data: stage, error } = await supabase
    .from('pipeline_stages')
    .insert({
      pipeline_id: pipelineId,
      name: body.name || 'New Stage',
      color: body.color || '#3B82F6',
      position: nextPosition,
      status_mapping: body.status_mapping || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ stage }, { status: 201 })
}

// PATCH /api/pipelines/[id]/stages — bulk update stage positions/names
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

  // body.stages = [{ id, name?, color?, position?, status_mapping? }]
  if (!body.stages || !Array.isArray(body.stages)) {
    return NextResponse.json({ error: 'stages array required' }, { status: 400 })
  }

  const errors: string[] = []
  for (const stage of body.stages) {
    const updates: Record<string, unknown> = {}
    if (stage.name !== undefined) updates.name = stage.name
    if (stage.color !== undefined) updates.color = stage.color
    if (stage.position !== undefined) updates.position = stage.position
    if (stage.status_mapping !== undefined) updates.status_mapping = stage.status_mapping

    const { error } = await supabase
      .from('pipeline_stages')
      .update(updates)
      .eq('id', stage.id)
      .eq('pipeline_id', pipelineId)

    if (error) errors.push(error.message)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/pipelines/[id]/stages — delete a stage (body: { stage_id })
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

  if (!body.stage_id) {
    return NextResponse.json({ error: 'stage_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', body.stage_id)
    .eq('pipeline_id', pipelineId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
