import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

const BUILT_IN_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome-new-member',
    name: 'Welcome New Member',
    subject: 'Welcome to {{group_name}}!',
    body: `Hi {{name}},

Welcome to {{group_name}}! We're excited to have you join our community.

This is the start of something great. Feel free to introduce yourself and jump into conversations that interest you.

Looking forward to seeing you around!

Best regards,
The {{group_name}} Team`,
  },
  {
    id: 'follow-up',
    name: 'Follow Up',
    subject: 'Checking in - {{group_name}}',
    body: `Hi {{name}},

I wanted to check in and see how you're doing with {{group_name}}.

Have you had a chance to check out any of the recent discussions? We'd love to hear your thoughts.

Feel free to reach out if you have any questions or suggestions.

Best regards,
The {{group_name}} Team`,
  },
  {
    id: 'special-offer',
    name: 'Special Offer',
    subject: 'Exclusive opportunity for {{group_name}} members',
    body: `Hi {{name}},

We have an exclusive opportunity for members of {{group_name}}.

This is limited time, so don't miss out!

[Add your offer details here]

Best regards,
The {{group_name}} Team`,
  },
]

/**
 * GET /api/email/templates
 * Returns a list of built-in email templates
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      templates: BUILT_IN_TEMPLATES,
      success: true,
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch templates: ${errorMessage}` },
      { status: 500 }
    )
  }
}
