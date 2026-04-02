import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/members/import — import members from CSV
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { group_id, members: csvMembers } = body

  if (!group_id || !Array.isArray(csvMembers) || csvMembers.length === 0) {
    return NextResponse.json(
      { error: 'group_id and members array are required' },
      { status: 400 }
    )
  }

  // Verify user owns this group (RLS covers this, but be explicit)
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', group_id)
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Group not found or access denied' }, { status: 404 })
  }

  // Case-insensitive field lookup helper
  function getField(row: Record<string, string>, ...keys: string[]): string | null {
    for (const key of keys) {
      // Check exact match first
      if (row[key] !== undefined && row[key] !== '') return row[key]
      // Check case-insensitive match
      const lower = key.toLowerCase()
      const found = Object.keys(row).find(k => k.toLowerCase() === lower)
      if (found && row[found] !== undefined && row[found] !== '') return row[found]
    }
    return null
  }

  // Insert members in batch
  const membersToInsert = csvMembers.map((m: Record<string, string>) => {
    const tagsRaw = getField(m, 'tags', 'Tags')
    return {
      group_id,
      name: getField(m, 'name', 'Name', 'full_name', 'Full Name') || 'Unknown',
      email: getField(m, 'email', 'Email', 'email_address', 'Email Address'),
      phone: getField(m, 'phone', 'Phone', 'phone_number', 'Phone Number'),
      status: 'new' as const,
      tags: tagsRaw ? tagsRaw.split(';').map((t: string) => t.trim()).filter(Boolean) : [],
      notes: getField(m, 'notes', 'Notes'),
      fb_profile_url: getField(m, 'fb_profile_url', 'Facebook Profile', 'fb_url', 'Profile URL'),
      approved_at: getField(m, 'approved_at', 'Approved At', 'approved_date') || new Date().toISOString(),
    }
  })

  const { data: inserted, error } = await supabase
    .from('members')
    .insert(membersToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    imported: inserted?.length || 0,
    total: csvMembers.length,
  }, { status: 201 })
}
