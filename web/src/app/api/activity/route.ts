import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    let query = supabase
      .from('activity_log')
      .select('id, action, member_id, group_id, details, performed_by, created_at')
      .eq('performed_by', user.id)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100))

    if (action) {
      query = query.eq('action', action)
    }

    const { data: activity, error } = await query

    if (error) {
      console.error('Activity fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
    }

    // Map details to metadata for backward compatibility with email page
    const mapped = (activity || []).map((entry) => ({
      ...entry,
      metadata: entry.details || {},
    }))

    return NextResponse.json({ activity: mapped })
  } catch (error) {
    console.error('Activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
