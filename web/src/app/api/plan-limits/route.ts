import { NextResponse } from 'next/server'
import { getUserPlan, getLimits } from '@/lib/plan-limits'

// GET /api/plan-limits — return current user's plan and limits
export async function GET() {
  try {
    const plan = await getUserPlan()
    const limits = getLimits(plan)
    return NextResponse.json({ plan, limits })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch plan limits' }, { status: 500 })
  }
}
