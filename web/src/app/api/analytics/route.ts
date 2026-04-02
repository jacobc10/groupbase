import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's groups
    const { data: userGroups } = await supabase
      .from('groups')
      .select('id, name')
      .eq('owner_id', user.id)

    if (!userGroups || userGroups.length === 0) {
      return NextResponse.json({
        membersByDay: [],
        statusBreakdown: { new: 0, contacted: 0, qualified: 0, converted: 0, archived: 0 },
        membersByGroup: [],
        growthRate: 0,
        conversionFunnel: [],
        topTags: [],
        recentActivity: []
      })
    }

    const groupIds = userGroups.map(g => g.id)

    // 1. membersByDay - Last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: membersRaw } = await supabase
      .from('members')
      .select('created_at')
      .in('group_id', groupIds)
      .gte('created_at', thirtyDaysAgo.toISOString())

    const membersByDay = processMembersByDay(membersRaw || [])

    // 2. statusBreakdown
    const { data: allMembers } = await supabase
      .from('members')
      .select('status')
      .in('group_id', groupIds)

    const statusBreakdown = processStatusBreakdown(allMembers || [])

    // 3. membersByGroup
    const { data: groupMembers } = await supabase
      .from('members')
      .select('group_id')
      .in('group_id', groupIds)

    const membersByGroup = processMembersByGroup(groupMembers || [], userGroups)

    // 4. growthRate - This week vs last week
    const growthRate = calculateGrowthRate(membersRaw || [])

    // 5. conversionFunnel
    const conversionFunnel = processConversionFunnel(allMembers || [])

    // 6. topTags
    const { data: tagsData } = await supabase
      .from('members')
      .select('tags')
      .in('group_id', groupIds)
      .not('tags', 'is', null)

    const topTags = processTopTags(tagsData || [])

    // 7. recentActivity - Last 20 entries with member name
    const { data: activityData } = await supabase
      .from('activity_log')
      .select(`
        id,
        action,
        details,
        performed_by,
        created_at,
        member_id,
        members(name)
      `)
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(20)

    const recentActivity = (activityData || []).map((log: any) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      performedBy: log.performed_by,
      createdAt: log.created_at,
      memberId: log.member_id,
      memberName: Array.isArray(log.members) ? log.members[0]?.name : log.members?.name || 'Unknown'
    }))

    // Map to frontend-expected field names
    const { archived, ...statusFunnel } = statusBreakdown as Record<string, number>

    return NextResponse.json({
      growthChart: membersByDay,
      statusFunnel,
      membersByGroup,
      weekOverWeekGrowth: growthRate,
      conversionFunnel,
      topTags,
      recentActivity: (recentActivity || []).map((a: any) => ({
        id: a.id,
        action: a.action,
        timestamp: a.createdAt,
        details: a.details,
        memberName: a.memberName,
      })),
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

// Helper Functions

function processMembersByDay(
  members: Array<{ created_at: string }>
): Array<{ date: string; count: number }> {
  const dateMap = new Map<string, number>()

  members.forEach(member => {
    const date = new Date(member.created_at).toISOString().split('T')[0]
    dateMap.set(date, (dateMap.get(date) || 0) + 1)
  })

  // Create array for last 30 days with all dates
  const result = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    result.push({
      date: dateStr,
      count: dateMap.get(dateStr) || 0
    })
  }

  return result
}

function processStatusBreakdown(
  members: Array<{ status: string }>
): Record<string, number> {
  const breakdown = {
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    archived: 0
  }

  members.forEach(member => {
    if (member.status in breakdown) {
      breakdown[member.status as keyof typeof breakdown]++
    }
  })

  return breakdown
}

function processMembersByGroup(
  members: Array<{ group_id: string }>,
  groups: Array<{ id: string; name: string }>
): Array<{ groupName: string; count: number }> {
  const groupMap = new Map<string, number>()

  members.forEach(member => {
    groupMap.set(member.group_id, (groupMap.get(member.group_id) || 0) + 1)
  })

  return groups
    .map(group => ({
      groupName: group.name,
      count: groupMap.get(group.id) || 0
    }))
    .sort((a, b) => b.count - a.count)
}

function calculateGrowthRate(members: Array<{ created_at: string }>): number {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const thisWeek = members.filter(
    m => new Date(m.created_at) > weekAgo
  ).length

  const lastWeek = members.filter(
    m => new Date(m.created_at) > twoWeeksAgo && new Date(m.created_at) <= weekAgo
  ).length

  if (lastWeek === 0) {
    return thisWeek > 0 ? 100 : 0
  }

  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100 * 10) / 10
}

function processConversionFunnel(
  members: Array<{ status: string }>
): Array<{ stage: string; count: number }> {
  const stages = ['new', 'contacted', 'qualified', 'converted']
  const funnel = []

  for (const stage of stages) {
    const count = members.filter(m => m.status === stage).length
    funnel.push({
      stage: stage.charAt(0).toUpperCase() + stage.slice(1),
      count
    })
  }

  return funnel
}

function processTopTags(
  members: Array<{ tags: string[] | null }>
): Array<{ tag: string; count: number }> {
  const tagMap = new Map<string, number>()

  members.forEach(member => {
    if (member.tags && Array.isArray(member.tags)) {
      member.tags.forEach(tag => {
        if (tag) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
        }
      })
    }
  })

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}
