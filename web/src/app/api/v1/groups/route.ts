import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'

/**
 * GET /api/v1/groups
 * List all groups for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  // Check plan allows API access (pro and enterprise only)
  if (validation.plan === 'free') {
    return NextResponse.json(
      { error: 'API access is only available on Pro and Enterprise plans' },
      { status: 403 }
    )
  }

  try {
    const supabase = await createClient()

    // Fetch all groups owned by this user
    const { data: groups, error } = await supabase
      .from('groups')
      .select('*')
      .eq('owner_id', validation.userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: groups || [],
    })
  } catch (error) {
    console.error('API groups GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
