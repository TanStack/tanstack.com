import { db } from '~/db/client'
import { mcpApiKeys, mcpRateLimits, users } from '~/db/schema'
import { eq, sql } from 'drizzle-orm'

export type AuthResult =
  | { success: true; keyId: string; rateLimitPerMinute: number }
  | { success: false; error: string; status: number }

/**
 * Hash an API key using SHA-256
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a new API key
 * Returns the raw key (only shown once) and the hash for storage
 */
export async function generateApiKey(): Promise<{
  rawKey: string
  keyHash: string
  keyPrefix: string
}> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const rawKey =
    'ts_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  const keyHash = await hashApiKey(rawKey)
  const keyPrefix = rawKey.slice(0, 11)
  return { rawKey, keyHash, keyPrefix }
}

/**
 * Validate an API key from the Authorization header
 * Also checks that the user has the 'mcp' capability
 */
export async function validateApiKey(
  authHeader: string | null,
): Promise<AuthResult> {
  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header',
      status: 401,
    }
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return {
      success: false,
      error: 'Invalid Authorization header format. Expected: Bearer <token>',
      status: 401,
    }
  }

  const rawKey = match[1]
  const keyHash = await hashApiKey(rawKey)

  // Query API key with user to check capabilities
  const result = await db
    .select({
      id: mcpApiKeys.id,
      isActive: mcpApiKeys.isActive,
      expiresAt: mcpApiKeys.expiresAt,
      rateLimitPerMinute: mcpApiKeys.rateLimitPerMinute,
      userId: mcpApiKeys.userId,
      userCapabilities: users.capabilities,
    })
    .from(mcpApiKeys)
    .leftJoin(users, eq(mcpApiKeys.userId, users.id))
    .where(eq(mcpApiKeys.keyHash, keyHash))
    .limit(1)

  const apiKey = result[0]

  if (!apiKey) {
    return {
      success: false,
      error: 'Invalid API key',
      status: 401,
    }
  }

  if (!apiKey.isActive) {
    return {
      success: false,
      error: 'API key has been revoked',
      status: 401,
    }
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      success: false,
      error: 'API key has expired',
      status: 401,
    }
  }

  // Check that user has 'mcp' capability
  const capabilities = apiKey.userCapabilities ?? []
  if (!capabilities.includes('mcp')) {
    return {
      success: false,
      error: 'User does not have MCP access',
      status: 403,
    }
  }

  // Update last used timestamp (fire and forget)
  db.update(mcpApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpApiKeys.id, apiKey.id))
    .catch(() => {})

  return {
    success: true,
    keyId: apiKey.id,
    rateLimitPerMinute: apiKey.rateLimitPerMinute,
  }
}

/**
 * Check and increment rate limit for an identifier
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  identifierType: 'api_key' | 'ip',
  limitPerMinute: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date()
  // Round down to the current minute
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0,
  )
  const resetAt = new Date(windowStart.getTime() + 60 * 1000)

  // Try to increment existing record, or insert new one
  const result = await db
    .insert(mcpRateLimits)
    .values({
      identifier,
      identifierType,
      windowStart,
      requestCount: 1,
    })
    .onConflictDoUpdate({
      target: [mcpRateLimits.identifier, mcpRateLimits.windowStart],
      set: {
        requestCount: sql`${mcpRateLimits.requestCount} + 1`,
      },
    })
    .returning({ requestCount: mcpRateLimits.requestCount })

  const currentCount = result[0]?.requestCount ?? 1
  const remaining = Math.max(0, limitPerMinute - currentCount)
  const allowed = currentCount <= limitPerMinute

  return { allowed, remaining, resetAt }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) {
    return cfIp
  }

  return 'unknown'
}

/**
 * Clean up old rate limit records (older than 5 minutes)
 * Call periodically to prevent table bloat
 */
export async function cleanupRateLimits(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  await db
    .delete(mcpRateLimits)
    .where(sql`${mcpRateLimits.windowStart} < ${fiveMinutesAgo}`)
}
