/**
 * Email sender using Resend API
 * Handles single and bulk email sending with proper error handling
 */

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

interface SendBulkResult {
  sent: number
  failed: number
  errors: Array<{ to: string; error: string }>
}

interface BulkEmailRecipient {
  to: string
  subject: string
  html: string
}

const DEFAULT_FROM = 'GroupBase <notifications@groupbase.app>'

/**
 * Send a single email via Resend API
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from: string = DEFAULT_FROM
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not set in environment variables')
    return {
      success: false,
      error: 'Email service is not configured. Please set RESEND_API_KEY environment variable.',
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.message || `Resend API error: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      messageId: data.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Failed to send email: ${errorMessage}`,
    }
  }
}

/**
 * Send multiple emails with Promise.allSettled
 * Returns summary of sent, failed, and errors
 */
export async function sendBulkEmails(
  recipients: BulkEmailRecipient[],
  from: string = DEFAULT_FROM
): Promise<SendBulkResult & { success: boolean }> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not set in environment variables')
    return {
      success: false,
      sent: 0,
      failed: recipients.length,
      errors: recipients.map((r) => ({
        to: r.to,
        error: 'Email service is not configured. Please set RESEND_API_KEY environment variable.',
      })),
    }
  }

  const promises = recipients.map((recipient) =>
    sendEmail(recipient.to, recipient.subject, recipient.html, from)
  )

  const results = await Promise.allSettled(promises)

  let sent = 0
  let failed = 0
  const errors: Array<{ to: string; error: string }> = []

  results.forEach((result, index) => {
    const recipient = recipients[index]

    if (result.status === 'fulfilled') {
      if (result.value.success) {
        sent++
      } else {
        failed++
        errors.push({
          to: recipient.to,
          error: result.value.error || 'Unknown error',
        })
      }
    } else {
      failed++
      const errorMessage =
        result.reason instanceof Error ? result.reason.message : 'Unknown error'
      errors.push({
        to: recipient.to,
        error: errorMessage,
      })
    }
  })

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
  }
}
