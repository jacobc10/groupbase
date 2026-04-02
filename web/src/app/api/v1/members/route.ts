import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { Member } from '@/types/database'

/**
 * GET /api/v1/members
 * List members for a group via API
 *
 * Query params:
 * - group_id (required): Group ID to fetch members for
 * - status: Filter by status (new, contacted, qualified, converted, archived)
 * - search: Search by name or email
 * - limit: Max results (default 25, max 100)
 * - offset: Pagination offset (default 0)
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

  const searchParams = request.nextUrl.searchParams
  const groupId = searchParams.get('group_id')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const limitStr = searchParams.get('limit') || '25'
  const offsetStr = searchParams.get('offset') || '0'

  // Validate required params
  if (!groupId) {
    return NextResponse.json({ error: 'Missing required parameter: group_id' }, { status: 400 })
  }

  // Validate and clamp limit
  let limit = parseInt(limitStr)
  if (isNaN(limit) || limit < 1) limit = 25
  if (limit > 100) limit = 100

  // Validate offset
  let offset = parseInt(offsetStr)
  if (isNaN(offset) || offset < 0) offset = 0

  try {
    const supabase = await createClient()

    // Verify user owns this group (via RLS)
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('owner_id', validation.userId)
      .single()

    if (groupError || !group) {
      return NextResponse.json(
        { error: 'Group not found or you do not have access' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .eq('group_id', groupId)

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    // Search by name or email
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Sort by created_at descending
    query = query.order('created_at', { ascending: false })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: members, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: members || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('API members GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/v1/members
 * Create a new member via API
 *
 * Body:
 * - group_id (required): Group ID
 * - name (required): Member name
 * - email: Member email
 * - phone: Member phone
 * - tags: Array of tags
 * - status: Member status (default 'new')
 * - notes: Notes about member
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const validation = await validateApiKey(request)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 401 })
  }

  // Check plan allows API access
  if (validation.plan === 'free') {
    return NextResponse.json(
      { error: 'API access is only available on Pro and Enterprise plans' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.group_id || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: group_id, name' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user owns this group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', body.group_id)
      .eq('owner_id', validation.userId)
      .single()

    if (groupError || !group) {
      return NextResponse.json(
        { error: 'Group not found or you do not have access' },
        { status: 404 }
      )
    }

    // Create member
    const { data: member, error } = await supabase
      .from('members')
      .insert({
        group_id: body.group_id,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        status: body.status || 'new',
        notes: body.notes || null,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Member creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: member }, { status: 201 })
  } catch (error) {
    console.error('API members POST error:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
