import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendWebhook, type WebhookPayload } from '@/lib/integrations/webhook'

// POST /api/integrations/[id]/test — send a test event
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !integration) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
  }

  const config = integration.config as Record<string, unknown>

  if (integration.type === 'webhook' || integration.type === 'zapier') {
    const url = config.url as string
    if (!url) {
      return NextResponse.json({ error: 'No webhook URL configured' }, { status: 400 })
    }

    const testPayload: WebhookPayload = {
      event: 'test',
      data: {
        id: 'test-member-id',
        name: 'Test Member',
        email: 'test@example.com',
        phone: '+1234567890',
        status: 'new',
        tags: ['test'],
        group_id: integration.group_id,
        fb_profile_url: 'https://facebook.com/test',
        message: 'This is a test webhook from GroupBase',
      },
      timestamp: new Date().toISOString(),
      group_id: integration.group_id,
    }

    const result = await sendWebhook(url, testPayload, config.secret as string | undefined)

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      duration: result.duration,
      error: result.error,
    })
  }

  // For GHL and Mailchimp, we don't send test events to avoid creating real contacts
  return NextResponse.json({
    success: true,
    message: `Test not available for ${integration.type}. Integration will trigger when a member is approved.`,
  })
}
