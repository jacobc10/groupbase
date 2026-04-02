import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkIntegrationLimit } from '@/lib/plan-limits'

// GET /api/integrations — list integrations for a group (or all user's groups)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const groupId = request.nextUrl.searchParams.get('group_id')

  let query = supabase
    .from('integrations')
    .select('*, group:groups!inner(id, name)')
    .order('created_at', { ascending: false })

  if (groupId) {
    query = query.eq('group_id', groupId)
  }

  const { data: integrations, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ integrations: integrations || [] })
}

// POST /api/integrations — create a new integration
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.group_id || !body.type) {
    return NextResponse.json({ error: 'group_id and type are required' }, { status: 400 })
  }

  // Check plan limits
  const limitCheck = await checkIntegrationLimit(user.id, body.group_id)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Integration limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more integrations.`,
        code: 'PLAN_LIMIT_REACHED',
        current: limitCheck.current,
        limit: limitCheck.limit,
      },
      { status: 403 }
    )
  }

  // Validate config based on type
  const config = body.config || {}
  const validTypes = ['webhook', 'gohighlevel', 'mailchimp', 'zapier']
  if (!validTypes.includes(body.type)) {
    return NextResponse.json({ error: `Invalid integration type: ${body.type}` }, { status: 400 })
  }

  const { data: integration, error } = await supabase
    .from('integrations')
    .insert({
      group_id: body.group_id,
      type: body.type,
      config,
      active: body.active !== false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ integration }, { status: 201 })
}
