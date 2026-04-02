import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getLimits } from '@/lib/plan-limits'

export interface AutomationAction {
  type: 'add_tag' | 'set_status' | 'send_email' | 'webhook' | 'wait'
  config: Record<string, unknown>
}

export interface Automation {
  id: string
  group_id: string
  name: string
  trigger: 'member.created' | 'member.status_changed'
  active: boolean
  actions: AutomationAction[]
  created_at: string
  updated_at: string
}

// GET /api/automations — list automations for user's groups
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const groupId = request.nextUrl.searchParams.get('group_id')

  // Get automations from integrations table where type='automation'
  let query = supabase
    .from('integrations')
    .select('*, group:groups!inner(id, name)')
    .eq('type', 'automation')
    .order('created_at', { ascending: false })

  if (groupId) {
    query = query.eq('group_id', groupId)
  }

  const { data: integrations, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform integrations into automations
  const automations = (integrations || []).map((int) => ({
    id: int.id,
    group_id: int.group_id,
    name: int.name,
    trigger: (int.config as any)?.trigger || 'member.created',
    active: int.active || false,
    actions: (int.config as any)?.actions || [],
    created_at: int.created_at,
    updated_at: int.updated_at,
  }))

  return NextResponse.json({ automations })
}

// POST /api/automations — create a new automation
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.group_id || !body.name || !body.trigger) {
    return NextResponse.json(
      { error: 'group_id, name, and trigger are required' },
      { status: 400 }
    )
  }

  // Check plan limits for automations
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan = (profile?.plan as 'free' | 'pro' | 'enterprise') || 'free'
  const limits = getLimits(plan)

  if (limits.integrations === 0) {
    return NextResponse.json(
      {
        error: 'Automations are not available on the Free plan. Upgrade to Pro or Enterprise.',
        code: 'PLAN_LIMIT_REACHED',
      },
      { status: 403 }
    )
  }

  // Count existing automations for this group
  if (limits.integrations !== -1) {
    const { count } = await supabase
      .from('integrations')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', body.group_id)
      .eq('type', 'automation')

    const current = count || 0
    if (current >= limits.integrations) {
      return NextResponse.json(
        {
          error: `Automation limit reached (${current}/${limits.integrations}). Upgrade your plan for more automations.`,
          code: 'PLAN_LIMIT_REACHED',
          current,
          limit: limits.integrations,
        },
        { status: 403 }
      )
    }
  }

  // Create automation as an integration with type='automation'
  const { data: automation, error } = await supabase
    .from('integrations')
    .insert({
      group_id: body.group_id,
      type: 'automation',
      name: body.name,
      active: body.active !== false,
      config: {
        trigger: body.trigger,
        actions: body.actions || [],
      },
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log activity
  await supabase.from('activity_log').insert({
    group_id: body.group_id,
    action: 'automation_created',
    details: { automation_id: automation.id, name: automation.name },
    performed_by: user.id,
  })

  return NextResponse.json(
    {
      automation: {
        id: automation.id,
        group_id: automation.group_id,
        name: automation.name,
        trigger: (automation.config as any).trigger,
        active: automation.active,
        actions: (automation.config as any).actions || [],
        created_at: automation.created_at,
        updated_at: automation.updated_at,
      },
    },
    { status: 201 }
  )
}
