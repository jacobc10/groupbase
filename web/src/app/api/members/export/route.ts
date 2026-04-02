import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkCsvExportAllowed } from '@/lib/plan-limits'

// GET /api/members/export — export members as CSV
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check plan allows CSV export
  const canExport = await checkCsvExportAllowed(user.id)
  if (!canExport) {
    return NextResponse.json(
      { error: 'CSV export requires a Pro or Enterprise plan.', code: 'PLAN_LIMIT_REACHED' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const groupId = searchParams.get('group_id') || ''
  const status = searchParams.get('status') || ''

  let query = supabase
    .from('members')
    .select('*, group:groups!inner(name)')
    .order('created_at', { ascending: false })

  if (groupId) {
    query = query.eq('group_id', groupId)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: members, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build CSV
  const headers = ['Name', 'Email', 'Phone', 'Group', 'Status', 'Tags', 'Notes', 'Approved At', 'Facebook Profile']
  const rows = (members || []).map((m: Record<string, unknown>) => {
    const group = m.group as { name: string } | null
    return [
      m.name || '',
      m.email || '',
      m.phone || '',
      group?.name || '',
      m.status || '',
      Array.isArray(m.tags) ? (m.tags as string[]).join('; ') : '',
      ((m.notes as string) || '').replace(/"/g, '""'),
      m.approved_at || '',
      m.fb_profile_url || '',
    ]
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  // Log export activity
  if (members && members.length > 0) {
    const firstMember = members[0] as { group_id: string }
    await supabase.from('activity_log').insert({
      member_id: null,
      group_id: groupId || firstMember.group_id,
      action: 'exported',
      details: { count: members.length, format: 'csv' },
      performed_by: user.id,
    })
  }

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="groupbase-members-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
