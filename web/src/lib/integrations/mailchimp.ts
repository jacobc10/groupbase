/**
 * Mailchimp API integration
 * Syncs GroupBase members to a Mailchimp audience
 */

import crypto from 'crypto'

interface MailchimpConfig {
  api_key: string       // Format: key-dc (e.g., abc123-us21)
  audience_id: string   // Also called list_id
  tag?: string          // Optional tag to apply
}

interface MemberData {
  name: string
  email: string
  tags?: string[]
  group_name?: string
}

export interface MailchimpResult {
  success: boolean
  memberId?: string
  error?: string
}

function getDataCenter(apiKey: string): string {
  const parts = apiKey.split('-')
  return parts[parts.length - 1] || 'us21'
}

function getSubscriberHash(email: string): string {
  return crypto.createHash('md5').update(email.toLowerCase()).digest('hex')
}

/**
 * Add or update a member in a Mailchimp audience
 */
export async function syncToMailchimp(
  config: MailchimpConfig,
  member: MemberData
): Promise<MailchimpResult> {
  if (!member.email) {
    return { success: false, error: 'Email is required for Mailchimp sync' }
  }

  const dc = getDataCenter(config.api_key)
  const subscriberHash = getSubscriberHash(member.email)
  const nameParts = (member.name || '').split(' ')

  const subscriberData = {
    email_address: member.email,
    status_if_new: 'subscribed',
    merge_fields: {
      FNAME: nameParts[0] || '',
      LNAME: nameParts.slice(1).join(' ') || '',
      SOURCE: 'GroupBase',
      FB_GROUP: member.group_name || '',
    },
  }

  try {
    // Use PUT for upsert (add or update)
    const response = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${config.audience_id}/members/${subscriberHash}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`anystring:${config.api_key}`).toString('base64')}`,
        },
        body: JSON.stringify(subscriberData),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `Mailchimp API error ${response.status}: ${(errorData as Record<string, string>).detail || 'Unknown error'}`,
      }
    }

    const result = await response.json() as { id: string }

    // Apply tags if configured
    const tags = [...(member.tags || [])]
    if (config.tag) tags.push(config.tag)

    if (tags.length > 0) {
      await fetch(
        `https://${dc}.api.mailchimp.com/3.0/lists/${config.audience_id}/members/${subscriberHash}/tags`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`anystring:${config.api_key}`).toString('base64')}`,
          },
          body: JSON.stringify({
            tags: tags.map((t) => ({ name: t, status: 'active' })),
          }),
        }
      )
    }

    return {
      success: true,
      memberId: result.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
