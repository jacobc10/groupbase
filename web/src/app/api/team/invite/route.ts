import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, getLimits } from '@/lib/plan-limits'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin or member' },
        { status: 400 }
      )
    }

    // Get user's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, owner_id')
      .eq('owner_id', user.id)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found. Only team owners can invite members.' },
        { status: 404 }
      )
    }

    // Only owner can invite
    if (team.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only team owner can invite members' },
        { status: 403 }
      )
    }

    // Check plan limits
    const plan = await getUserPlan()
    const limits = getLimits(plan)
    const seatLimit = limits.teamMembers as number

    // Count current team size (owner + team_members)
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)

    const totalMembers = (memberCount || 0) + 1 // +1 for owner

    if (totalMembers >= seatLimit) {
      return NextResponse.json(
        { error: `Team limit reached (${totalMembers}/${seatLimit}). Upgrade your plan to add more members.`, code: 'TEAM_LIMIT_REACHED' },
        { status: 403 }
      )
    }

    // Look up invited user by email
    const { data: invitedUser, error: userLookupError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .single()

    if (userLookupError || !invitedUser) {
      return NextResponse.json(
        { error: 'User not found. They need to create a GroupBase account first.' },
        { status: 404 }
      )
    }

    // Can't invite yourself
    if (invitedUser.id === user.id) {
      return NextResponse.json(
        { error: 'You cannot invite yourself' },
        { status: 400 }
      )
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', invitedUser.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'This user is already on your team' },
        { status: 409 }
      )
    }

    // Add team member
    const { data: newMember, error: insertError } = await supabase
      .from('team_members')
      .insert([{
        team_id: team.id,
        user_id: invitedUser.id,
        role,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Failed to add team member:', insertError)
      return NextResponse.json(
        { error: 'Failed to add team member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `${invitedUser.full_name || invitedUser.email} has been added to your team as ${role}`,
      member: {
        id: invitedUser.id,
        full_name: invitedUser.full_name,
        email: invitedUser.email,
        role: newMember.role,
        created_at: newMember.created_at,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Team invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
