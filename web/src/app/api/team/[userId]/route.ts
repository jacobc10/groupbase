import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await params
    const body = await request.json()
    const { role } = body

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      )
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin or member' },
        { status: 400 }
      )
    }

    // Get the team for this team member
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, user_id, role')
      .eq('user_id', userId)
      .single()

    if (memberError || !teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Get team info to check if current user is owner
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', teamMember.team_id)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Only owner can change roles
    if (team.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only team owner can change member roles' },
        { status: 403 }
      )
    }

    // Can't change own role
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      )
    }

    // Update the role
    const { data: updatedMember, error: updateError } = await supabase
      .from('team_members')
      .update({ role })
      .eq('user_id', userId)
      .eq('team_id', teamMember.team_id)
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles:user_id(email, full_name)
      `)
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update team member' },
        { status: 500 }
      )
    }

    const profile = Array.isArray((updatedMember as any).profiles)
      ? (updatedMember as any).profiles[0]
      : (updatedMember as any).profiles
    return NextResponse.json({
      id: updatedMember.id,
      user_id: updatedMember.user_id,
      role: updatedMember.role,
      email: profile?.email,
      full_name: profile?.full_name,
      created_at: updatedMember.created_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await params

    // Get the team member
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, user_id, role')
      .eq('user_id', userId)
      .single()

    if (memberError || !teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Get team info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', teamMember.team_id)
      .single()

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Only owner or the user themselves can remove
    if (team.owner_id !== user.id && userId !== user.id) {
      return NextResponse.json(
        { error: 'Only team owner or the member can remove from team' },
        { status: 403 }
      )
    }

    // Can't remove the owner
    if (teamMember.role === 'owner' || team.owner_id === userId) {
      return NextResponse.json(
        { error: 'Cannot remove team owner' },
        { status: 400 }
      )
    }

    // Remove the team member
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', userId)
      .eq('team_id', teamMember.team_id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to remove team member' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Team member removed successfully' },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
