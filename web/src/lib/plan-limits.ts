import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanKey, getPlanLimits } from '@/lib/stripe'

export type { PlanKey }

// Re-export from canonical source — no duplicate definitions
const PLAN_LIMITS = {
  free: PLANS.free.limits,
  pro: PLANS.pro.limits,
  enterprise: PLANS.enterprise.limits,
} as const

export async function getUserPlan(): Promise<PlanKey> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'free'

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  return (profile?.plan as PlanKey) || 'free'
}

export function getLimits(plan: PlanKey) {
  return PLAN_LIMITS[plan]
}

export async function checkGroupLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan as PlanKey) || 'free'
  const limits = PLAN_LIMITS[plan]

  if (limits.groups === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const { count } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)

  const current = count || 0
  return {
    allowed: current < limits.groups,
    current,
    limit: limits.groups,
  }
}

export async function checkMemberLimit(userId: string, groupId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan as PlanKey) || 'free'
  const limits = PLAN_LIMITS[plan]

  if (limits.membersPerGroup === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const { count } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)

  const current = count || 0
  return {
    allowed: current < limits.membersPerGroup,
    current,
    limit: limits.membersPerGroup,
  }
}

export async function checkIntegrationLimit(userId: string, groupId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan as PlanKey) || 'free'
  const limits = PLAN_LIMITS[plan]

  if (limits.integrations === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const { count } = await supabase
    .from('integrations')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)

  const current = count || 0
  return {
    allowed: current < limits.integrations,
    current,
    limit: limits.integrations,
  }
}

export async function checkEmailLimit(userId: string, emailCount: number): Promise<{ allowed: boolean; dailyUsed: number; dailyLimit: number; monthlyUsed: number; monthlyLimit: number }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan as PlanKey) || 'free'
  const limits = PLAN_LIMITS[plan]
  const dailyLimit = limits.emailsPerDay as number
  const monthlyLimit = limits.emailsPerMonth as number

  // Unlimited emails
  if (dailyLimit === -1 && monthlyLimit === -1) {
    return { allowed: true, dailyUsed: 0, dailyLimit: -1, monthlyUsed: 0, monthlyLimit: -1 }
  }

  // Get user's groups to scope the activity log query
  const { data: userGroups } = await supabase
    .from('groups')
    .select('id')
    .eq('owner_id', userId)

  if (!userGroups || userGroups.length === 0) {
    return { allowed: true, dailyUsed: 0, dailyLimit, monthlyUsed: 0, monthlyLimit }
  }

  const groupIds = userGroups.map(g => g.id)

  // Count emails sent today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: dailyCount } = await supabase
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'email_sent')
    .in('group_id', groupIds)
    .gte('created_at', todayStart.toISOString())

  // Count emails sent this month
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: monthlyCount } = await supabase
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'email_sent')
    .in('group_id', groupIds)
    .gte('created_at', monthStart.toISOString())

  const dailyUsed = dailyCount || 0
  const monthlyUsed = monthlyCount || 0

  const dailyOk = dailyLimit === -1 || (dailyUsed + emailCount) <= dailyLimit
  const monthlyOk = monthlyLimit === -1 || (monthlyUsed + emailCount) <= monthlyLimit

  return {
    allowed: dailyOk && monthlyOk,
    dailyUsed,
    dailyLimit,
    monthlyUsed,
    monthlyLimit,
  }
}

export async function checkCsvExportAllowed(userId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan as PlanKey) || 'free'
  return PLAN_LIMITS[plan].csvExport
}
