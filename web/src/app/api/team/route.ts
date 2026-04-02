import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserPlan, getLimits } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get user's plan
    const plan = await getUserPlan()
    const limits = getLimits(plan)
    const seatLimit = limits.teamMembers as number

    // Check if user has a team (as owner)
    let { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id, name, owner_id')
      .eq('owner_id', user.id)
      .single()

    // If no team exists, create one
    if (teamError && teamError.code === 'PGRST116') {
      const teamName = `${user.user_metadata?.full_name || user.email}'s Team`

      const { data: newTeam, error: createError } = await supabase
        .from('teams')
        .insert([{ name: teamName, owner_id: user.id }])
        .select('id, name, owner_id')
        .single()

      if (createError) {
        return NextResponse.json(
          { error: 'Failed to create team' },
          { status: 500 }
        )
      }

      teamData = newTeam
    } else if (teamError) {
      // Maybe user is a member of another team, not owner
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        const { data: memberTeam } = await supabase
          .from('teams')
          .select('id, name, owner_id')
          .eq('id', membership.team_id)
          .single()

        if (memberTeam) {
          teamData = memberTeam
        }
      }

      if (!teamData) {
        return NextResponse.json(
          { error: 'Failed to fetch team' },
          { status: 500 }
        )
      }
    }

    // Get team members with profile info
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles:user_id(email, full_name)
      `)
      .eq('team_id', teamData!.id)

    if (membersError) {
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // Get owner's profile info
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', teamData!.owner_id)
      .single()

    // Build members list - owner first, then team_members
    const formattedMembers = []

    // Add owner as first member
    formattedMembers.push({
      id: teamData!.owner_id,
      full_name: ownerProfile?.full_name || null,
      email: ownerProfile?.email || user.email || '',
      role: 'owner' as const,
      created_at: teamData!.owner_id === user.id ? user.created_at : '',
    })

    // Add other team members
    for (const member of (members || [])) {
      const profile = Array.isArray((member as any).profiles)
        ? (member as any).profiles[0]
        : (member as any).profiles

      // Skip if this is the owner (already added)
      if (member.user_id === teamData!.owner_id) continue

      formattedMembers.push({
        id: member.user_id,
        full_name: profile?.full_name || null,
        email: profile?.email || '',
        role: member.role,
        created_at: member.created_at,
      })
    }

    // Determine current user's role
    let currentUserRole: 'owner' | 'admin' | 'member' = 'member'
    if (teamData!.owner_id === user.id) {
      currentUserRole = 'owner'
    } else {
      const userMembership = (members || []).find((m: any) => m.user_id === user.id)
      if (userMembership) {
        currentUserRole = userMembership.role as 'admin' | 'member'
      }
    }

    return NextResponse.json({
      team_name: teamData!.name,
      members: formattedMembers,
      current_user_id: user.id,
      current_user_role: currentUserRole,
      plan,
      plan_seat_limit: seatLimit,
    })
  } catch (error) {
    console.error('Team API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
