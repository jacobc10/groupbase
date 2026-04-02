/**
 * Automation Engine
 * Executes automation rules triggered by member events
 */

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { sendWebhook, WebhookPayload } from '@/lib/integrations/webhook'

export interface AutomationAction {
  type: 'add_tag' | 'set_status' | 'send_email' | 'webhook' | 'wait'
  config: Record<string, unknown>
}

export interface Automation {
  id: string
  group_id: string
  name: string
  trigger: 'member.created' | 'member.status_changed'
  active: boolean
  actions: AutomationAction[]
}

export interface MemberData {
  id: string
  name: string
  email?: string
  phone?: string
  status?: string
  tags?: string[]
  fb_profile_url?: string
  [key: string]: unknown
}

export interface ExecutionResult {
  automationId: string
  success: boolean
  executedActions: number
  errors: Array<{ action: number; error: string }>
}

/**
 * Execute automations for a given trigger
 */
export async function executeAutomations(
  trigger: string,
  memberData: MemberData,
  userId: string,
  groupId: string
): Promise<ExecutionResult[]> {
  const supabase = await createClient()

  // Fetch matching active automations
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'automation')
    .eq('group_id', groupId)
    .eq('active', true)

  if (error) {
    console.error('Error fetching automations:', error)
    return []
  }

  const automations = (integrations || []).map((int) => ({
    id: int.id,
    group_id: int.group_id,
    name: int.name,
    trigger: (int.config as any).trigger,
    active: int.active,
    actions: (int.config as any).actions || [],
  }))

  // Filter by trigger
  const matchingAutomations = automations.filter((a) => a.trigger === trigger)

  // Execute each matching automation
  const results: ExecutionResult[] = []

  for (const automation of matchingAutomations) {
    const result = await executeAutomation(automation, memberData, userId, supabase)
    results.push(result)
  }

  return results
}

/**
 * Execute a single automation
 */
async function executeAutomation(
  automation: Automation,
  memberData: MemberData,
  userId: string,
  supabase: any
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    automationId: automation.id,
    success: true,
    executedActions: 0,
    errors: [],
  }

  for (let i = 0; i < automation.actions.length; i++) {
    const action = automation.actions[i]

    try {
      await executeAction(action, memberData, automation.group_id, supabase)
      result.executedActions++
    } catch (err) {
      result.success = false
      result.errors.push({
        action: i,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      // Continue executing remaining actions instead of stopping
    }
  }

  // Log execution
  await logAutomationExecution(automation, memberData, result, userId, supabase)

  return result
}

/**
 * Execute a single action
 */
async function executeAction(
  action: AutomationAction,
  memberData: MemberData,
  groupId: string,
  supabase: any
): Promise<void> {
  switch (action.type) {
    case 'add_tag': {
      await addTag(memberData.id, action.config.tag as string, supabase)
      break
    }

    case 'set_status': {
      await setStatus(memberData.id, action.config.status as string, supabase)
      break
    }

    case 'send_email': {
      await sendEmailAction(
        memberData.email,
        action.config.subject as string,
        action.config.body as string,
        memberData
      )
      break
    }

    case 'webhook': {
      await sendWebhookAction(
        action.config.url as string,
        memberData,
        groupId,
        action.config.secret as string | undefined
      )
      break
    }

    case 'wait': {
      const delayMs = ((action.config.delay_minutes as number) || 0) * 60 * 1000
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      break
    }

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`)
  }
}

/**
 * Add a tag to a member
 */
async function addTag(memberId: string, tag: string, supabase: any): Promise<void> {
  if (!tag) {
    throw new Error('Tag is required')
  }

  // Get current tags
  const { data: member, error: getError } = await supabase
    .from('members')
    .select('tags')
    .eq('id', memberId)
    .single()

  if (getError) {
    throw new Error(`Failed to fetch member: ${getError.message}`)
  }

  const currentTags = Array.isArray(member.tags) ? member.tags : []

  // Add tag if not already present
  if (!currentTags.includes(tag)) {
    currentTags.push(tag)
  }

  const { error: updateError } = await supabase
    .from('members')
    .update({ tags: currentTags })
    .eq('id', memberId)

  if (updateError) {
    throw new Error(`Failed to update member tags: ${updateError.message}`)
  }
}

/**
 * Set member status
 */
async function setStatus(memberId: string, status: string, supabase: any): Promise<void> {
  if (!status) {
    throw new Error('Status is required')
  }

  const { error } = await supabase
    .from('members')
    .update({ status })
    .eq('id', memberId)

  if (error) {
    throw new Error(`Failed to update member status: ${error.message}`)
  }
}

/**
 * Send email action
 */
async function sendEmailAction(
  to: string | undefined,
  subject: string,
  body: string,
  memberData: MemberData
): Promise<void> {
  if (!to) {
    throw new Error('Member email is required for send_email action')
  }

  if (!subject || !body) {
    throw new Error('Subject and body are required for send_email action')
  }

  // Simple variable substitution: {{name}}, {{email}}, etc.
  const html = body
    .replace(/\{\{name\}\}/g, memberData.name || '')
    .replace(/\{\{email\}\}/g, memberData.email || '')
    .replace(/\{\{phone\}\}/g, (memberData.phone as string) || '')
    .replace(/\{\{status\}\}/g, (memberData.status as string) || '')

  const result = await sendEmail(to, subject, html)

  if (!result.success) {
    throw new Error(`Failed to send email: ${result.error}`)
  }
}

/**
 * Send webhook action
 */
async function sendWebhookAction(
  url: string,
  memberData: MemberData,
  groupId: string,
  secret?: string
): Promise<void> {
  if (!url) {
    throw new Error('Webhook URL is required')
  }

  const payload: WebhookPayload = {
    event: 'automation.executed',
    data: memberData,
    timestamp: new Date().toISOString(),
    group_id: groupId,
  }

  const result = await sendWebhook(url, payload, secret)

  if (!result.success) {
    throw new Error(`Failed to send webhook: ${result.error}`)
  }
}

/**
 * Log automation execution
 */
async function logAutomationExecution(
  automation: Automation,
  memberData: MemberData,
  result: ExecutionResult,
  userId: string,
  supabase: any
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    member_id: memberData.id,
    group_id: automation.group_id,
    action: 'automation_executed',
    details: {
      automation_id: automation.id,
      automation_name: automation.name,
      executed_actions: result.executedActions,
      total_actions: automation.actions.length,
      success: result.success,
      errors: result.errors,
    },
    performed_by: userId,
  })

  if (error) {
    console.error('Failed to log automation execution:', error)
  }
}
