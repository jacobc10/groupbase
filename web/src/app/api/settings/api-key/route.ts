import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateApiKey, hashApiKey } from '@/lib/api-auth'

/**
 * GET /api/settings/api-key
 * Check if user has an API key (session auth only)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('api_key_hash, updated_at')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      has_key: !!profile?.api_key_hash,
      created_at: profile?.api_key_hash ? profile.updated_at : null,
    })
  } catch (error) {
    console.error('Check API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/api-key
 * Generate a new API key (session auth only)
 * Returns the raw key ONCE - user must save it
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Generate new API key
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)

    // Store hash in database
    const { error } = await supabase
      .from('profiles')
      .update({
        api_key_hash: keyHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      console.error('Failed to store API key hash:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return raw key (only time it's shown)
    return NextResponse.json({
      api_key: apiKey,
    })
  } catch (error) {
    console.error('Generate API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/api-key
 * Revoke the API key (session auth only)
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        api_key_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Revoke API key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
