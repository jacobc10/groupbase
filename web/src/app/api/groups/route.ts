import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkGroupLimit } from '@/lib/plan-limits'

// GET /api/groups — list user's groups
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: groups, error } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ groups: groups || [] })
}

// POST /api/groups — create a new group
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check plan limits
  const groupLimit = await checkGroupLimit(user.id)
  if (!groupLimit.allowed) {
    return NextResponse.json(
      {
        error: `Group limit reached (${groupLimit.current}/${groupLimit.limit}). Upgrade your plan to add more groups.`,
        code: 'PLAN_LIMIT_REACHED',
        current: groupLimit.current,
        limit: groupLimit.limit,
      },
      { status: 403 }
    )
  }

  const body = await request.json()

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name: body.name,
      fb_group_id: body.fb_group_id || null,
      fb_group_url: body.fb_group_url || null,
      owner_id: user.id,
      team_id: body.team_id || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ group }, { status: 201 })
}
