import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/pipelines — list user's pipelines with stages
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: pipelines, error } = await supabase
    .from('pipelines')
    .select('*, stages:pipeline_stages(*, pipeline_members(count))')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sort stages by position within each pipeline
  const sorted = (pipelines || []).map(p => ({
    ...p,
    stages: (p.stages || []).sort((a: { position: number }, b: { position: number }) => a.position - b.position)
  }))

  return NextResponse.json({ pipelines: sorted })
}

// POST /api/pipelines — create a new pipeline with default stages
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const name = body.name || 'New Pipeline'
  const stages = body.stages || [
    { name: 'New Lead', color: '#6B7280', position: 0, status_mapping: 'new' },
    { name: 'Contacted', color: '#3B82F6', position: 1, status_mapping: 'contacted' },
    { name: 'Qualified', color: '#F59E0B', position: 2, status_mapping: 'qualified' },
    { name: 'Converted', color: '#10B981', position: 3, status_mapping: 'converted' },
  ]

  // Check if user has any pipelines — first one becomes default
  const { count } = await supabase
    .from('pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)

  const isDefault = (count || 0) === 0

  // Create pipeline
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({
      owner_id: user.id,
      name,
      description: body.description || null,
      is_default: isDefault,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Create stages
  const stageInserts = stages.map((s: { name: string; color: string; position: number; status_mapping?: string }) => ({
    pipeline_id: pipeline.id,
    name: s.name,
    color: s.color,
    position: s.position,
    status_mapping: s.status_mapping || null,
  }))

  const { data: createdStages, error: stageError } = await supabase
    .from('pipeline_stages')
    .insert(stageInserts)
    .select()

  if (stageError) {
    return NextResponse.json({ error: stageError.message }, { status: 500 })
  }

  return NextResponse.json({
    pipeline: { ...pipeline, stages: createdStages }
  }, { status: 201 })
}
