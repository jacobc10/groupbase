import { createHash, randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/types/database'

const API_KEY_PREFIX = 'gb_live_'
const API_KEY_LENGTH = 32 // hex chars for random part

/**
 * Generate a new API key
 * Format: gb_live_[32 random hex characters]
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(16).toString('hex') // 32 hex chars from 16 bytes
  return `${API_KEY_PREFIX}${randomPart}`
}

/**
 * Hash an API key for storage
 * Uses SHA-256 to hash the key before storing in database
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Validate an API key from the Authorization header
 * Extracts Bearer token, hashes it, and looks up in profiles.api_key_hash
 *
 * Returns validation result with userId and plan, or error
 */
export async function validateApiKey(
  request: NextRequest
): Promise<
  | { valid: true; userId: string; plan: Profile['plan'] }
  | { valid: false; error: string }
> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' }
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { valid: false, error: 'Invalid Authorization header format. Use: Bearer <api_key>' }
  }

  const apiKey = parts[1]

  // Validate format
  if (!apiKey.startsWith(API_KEY_PREFIX) || apiKey.length !== API_KEY_PREFIX.length + API_KEY_LENGTH) {
    return { valid: false, error: 'Invalid API key format' }
  }

  try {
    const supabase = await createClient()
    const keyHash = hashApiKey(apiKey)

    // Look up the API key hash in profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, plan')
      .eq('api_key_hash', keyHash)
      .single()

    if (error || !profile) {
      return { valid: false, error: 'Invalid API key' }
    }

    return {
      valid: true,
      userId: profile.id,
      plan: profile.plan,
    }
  } catch (error) {
    console.error('API key validation error:', error)
    return { valid: false, error: 'Failed to validate API key' }
  }
}
