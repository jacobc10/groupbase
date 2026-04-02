import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkEmailLimit } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limits = await checkEmailLimit(user.id, 0)
    return NextResponse.json(limits)
  } catch (error) {
    console.error('Email limits error:', error)
    return NextResponse.json({ error: 'Failed to check email limits' }, { status: 500 })
  }
}
