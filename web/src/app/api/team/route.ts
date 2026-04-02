import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user has a team
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
      return NextResponse.json(
        { error: 'Failed to fetch team' },
        { status: 500 }
      )
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

    // Format members response
    const formattedMembers = members.map((member: any) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      email: member.profiles?.email,
      full_name: member.profiles?.full_name,
      created_at: member.created_at,
    }))

    return NextResponse.json({
      team: teamData,
      members: formattedMembers,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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
        { error: 'Team not found' },
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

    // Get user's profile to check plan
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Check plan limits
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)

    const allowedMembers =
      userProfile.plan === 'enterprise'
        ? Infinity
        : userProfile.plan === 'pro'
        ? 3
        : 0

    if (memberCount! >= allowedMembers) {
      return NextResponse.json(
        { error: `Plan limit reached. ${userProfile.plan} plan allows ${allowedMembers === Infinity ? 'unlimited' : allowedMembers} members` },
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
        { error: 'User not found. They need to sign up first.' },
        { status: 404 }
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
        { error: 'User is already a team member' },
        { status: 409 }
      )
    }

    // Add team member
    const { data: newMember, error: insertError } = await supabase
      .from('team_members')
      .insert([
        {
          team_id: team.id,
          user_id: invitedUser.id,
          role,
        },
      ])
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to add team member' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        id: newMember.id,
        user_id: newMember.user_id,
        role: newMember.role,
        email: invitedUser.email,
        full_name: invitedUser.full_name,
        created_at: newMember.created_at,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
