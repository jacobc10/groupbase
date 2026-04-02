import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete in dependency order:
    // 1. Activity logs (references members and groups)
    const { data: userGroups } = await supabase
      .from('groups')
      .select('id')
      .eq('owner_id', user.id)

    const groupIds = userGroups?.map((g) => g.id) || []

    if (groupIds.length > 0) {
      // Delete activity logs for user's groups
      await supabase
        .from('activity_log')
        .delete()
        .in('group_id', groupIds)

      // Delete integrations for user's groups
      await supabase
        .from('integrations')
        .delete()
        .in('group_id', groupIds)

      // Delete members for user's groups
      await supabase
        .from('members')
        .delete()
        .in('group_id', groupIds)

      // Delete the groups themselves
      await supabase
        .from('groups')
        .delete()
        .eq('owner_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete data error:', error)
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    )
  }
}
