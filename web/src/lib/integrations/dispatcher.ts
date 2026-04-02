/**
 * Integration event dispatcher
 * Fires all active integrations for a group when member events occur
 */

import { createClient } from '@/lib/supabase/server'
import { sendWebhookWithRetry, type WebhookPayload } from './webhook'
import { syncToGoHighLevel } from './gohighlevel'
import { syncToMailchimp } from './mailchimp'

export type IntegrationEvent =
  | 'member.created'
  | 'member.updated'
  | 'member.status_changed'
  | 'member.deleted'

interface MemberEventData {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  fb_profile_url?: string | null
  tags?: string[]
  status?: string
  group_id: string
  group_name?: string
  answers?: unknown[]
}

/**
 * Dispatch an event to all active integrations for a group.
 * This is fire-and-forget — errors are logged but don't bubble up.
 */
export async function dispatchIntegrationEvent(
  event: IntegrationEvent,
  memberData: MemberEventData,
  userId: string
) {
  const supabase = await createClient()

  // Fetch all active integrations for this group
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('group_id', memberData.group_id)
    .eq('active', true)

  if (error || !integrations || integrations.length === 0) return

  const results = await Promise.allSettled(
    integrations.map(async (integration) => {
      const config = integration.config as Record<string, unknown>
      let success = false
      let details: Record<string, unknown> = {}

      try {
        switch (integration.type) {
          case 'webhook':
          case 'zapier': {
            const url = config.url as string
            const secret = config.secret as string | undefined
            const payload: WebhookPayload = {
              event,
              data: memberData as unknown as Record<string, unknown>,
              timestamp: new Date().toISOString(),
              group_id: memberData.group_id,
            }
            const result = await sendWebhookWithRetry(url, payload, secret)
            success = result.success
            details = { statusCode: result.statusCode, duration: result.duration, error: result.error }
            break
          }

          case 'gohighlevel': {
            if (event !== 'member.created' && event !== 'member.updated') break
            const result = await syncToGoHighLevel(
              {
                api_key: config.api_key as string,
                location_id: config.location_id as string,
                tag: config.tag as string | undefined,
              },
              {
                name: memberData.name,
                email: memberData.email,
                phone: memberData.phone,
                tags: memberData.tags,
                fb_profile_url: memberData.fb_profile_url,
                group_name: memberData.group_name,
              }
            )
            success = result.success
            details = { contactId: result.contactId, error: result.error }
            break
          }

          case 'mailchimp': {
            if (event !== 'member.created' && event !== 'member.updated') break
            if (!memberData.email) {
              details = { error: 'Member has no email, skipping Mailchimp sync' }
              break
            }
            const result = await syncToMailchimp(
              {
                api_key: config.api_key as string,
                audience_id: config.audience_id as string,
                tag: config.tag as string | undefined,
              },
              {
                name: memberData.name,
                email: memberData.email,
                tags: memberData.tags,
                group_name: memberData.group_name,
              }
            )
            success = result.success
            details = { memberId: result.memberId, error: result.error }
            break
          }
        }
      } catch (err) {
        details = { error: err instanceof Error ? err.message : 'Unknown error' }
      }

      // Update last_synced_at on success
      if (success) {
        await supabase
          .from('integrations')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', integration.id)
      }

      // Log activity
      await supabase.from('activity_log').insert({
        member_id: memberData.id,
        group_id: memberData.group_id,
        action: 'integration_synced',
        details: {
          integration_type: integration.type,
          integration_id: integration.id,
          event,
          success,
          ...details,
        },
        performed_by: userId,
      })

      return { type: integration.type, success, details }
    })
  )

  return results
}
