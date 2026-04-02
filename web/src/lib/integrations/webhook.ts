/**
 * Generic webhook sender with retry logic
 */

export interface WebhookPayload {
  event: string
  data: Record<string, unknown>
  timestamp: string
  group_id: string
}

export interface WebhookResult {
  success: boolean
  statusCode?: number
  error?: string
  duration?: number
}

export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string
): Promise<WebhookResult> {
  const start = Date.now()
  const body = JSON.stringify(payload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'GroupBase-Webhook/1.0',
    'X-GroupBase-Event': payload.event,
    'X-GroupBase-Timestamp': payload.timestamp,
  }

  // Add HMAC signature if secret is provided
  if (secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    headers['X-GroupBase-Signature'] = `sha256=${hex}`
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    return {
      success: response.ok,
      statusCode: response.status,
      duration: Date.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    }
  }
}

/**
 * Send webhook with up to 3 retry attempts
 */
export async function sendWebhookWithRetry(
  url: string,
  payload: WebhookPayload,
  secret?: string,
  maxRetries = 3
): Promise<WebhookResult> {
  let lastResult: WebhookResult = { success: false, error: 'No attempts made' }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }

    lastResult = await sendWebhook(url, payload, secret)

    if (lastResult.success) return lastResult

    // Don't retry client errors (4xx) except 429
    if (lastResult.statusCode && lastResult.statusCode >= 400 && lastResult.statusCode < 500 && lastResult.statusCode !== 429) {
      return lastResult
    }
  }

  return lastResult
}
