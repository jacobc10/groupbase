/**
 * GoHighLevel API integration
 * Syncs GroupBase members as GHL contacts
 */

interface GHLConfig {
  api_key: string
  location_id: string
  tag?: string
}

interface MemberData {
  name: string
  email?: string | null
  phone?: string | null
  tags?: string[]
  fb_profile_url?: string | null
  group_name?: string
}

export interface GHLResult {
  success: boolean
  contactId?: string
  error?: string
}

/**
 * Create or update a contact in GoHighLevel
 */
export async function syncToGoHighLevel(
  config: GHLConfig,
  member: MemberData
): Promise<GHLResult> {
  const nameParts = (member.name || '').split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  const contactData: Record<string, unknown> = {
    firstName,
    lastName,
    locationId: config.location_id,
    source: 'GroupBase',
    tags: [...(member.tags || [])],
  }

  // Add optional fields
  if (member.email) contactData.email = member.email
  if (member.phone) contactData.phone = member.phone

  // Add custom fields
  const customFields: Record<string, string>[] = []
  if (member.fb_profile_url) {
    customFields.push({ key: 'facebook_profile', value: member.fb_profile_url })
  }
  if (member.group_name) {
    customFields.push({ key: 'facebook_group', value: member.group_name })
  }
  if (customFields.length > 0) {
    contactData.customFields = customFields
  }

  // Add default tag if configured
  if (config.tag) {
    (contactData.tags as string[]).push(config.tag)
  }

  try {
    // Try to create contact first (GHL upserts by email/phone)
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(contactData),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `GHL API error ${response.status}: ${errorText}`,
      }
    }

    const result = await response.json()
    return {
      success: true,
      contactId: result.contact?.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
