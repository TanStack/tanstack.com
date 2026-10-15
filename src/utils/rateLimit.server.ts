/**
 * Simple IP-based rate limiting for public API endpoints.
 * Uses the existing MCP rate limit infrastructure.
 */

import { db } from '~/db/client'
import { mcpRateLimits } from '~/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '~/mcp/auth.server'

export interface RateLimitOptions {
  limitPerMinute: number
  keyPrefix?: string // Namespace to separate different endpoints
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  headers: Headers
}

/**
 * Check rate limit for a request based on client IP.
 * Returns result with pre-built headers for the response.
 */
export async function checkIpRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const identifier = options.keyPrefix ? `${options.keyPrefix}:${ip}` : ip

  const result = await checkRateLimit(identifier, 'ip', options.limitPerMinute)

  const headers = new Headers()
  headers.set('X-RateLimit-Limit', options.limitPerMinute.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set(
    'X-RateLimit-Reset',
    Math.floor(result.resetAt.getTime() / 1000).toString(),
  )

  if (!result.allowed) {
    headers.set(
      'Retry-After',
      Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString(),
    )
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    headers,
  }
}

export async function checkUserRateLimit(
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const scopedIdentifier = options.keyPrefix
    ? `${options.keyPrefix}:${identifier}`
    : identifier
  const result = await checkRateLimit(
    scopedIdentifier,
    'user',
    options.limitPerMinute,
  )
  const headers = createRateLimitHeaders(options.limitPerMinute, result)

  return { ...result, headers }
}

/**
 * Create a rate-limited error response.
 */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        ...Object.fromEntries(result.headers.entries()),
      },
    },
  )
}

export interface WindowRateLimitOptions {
  keyPrefix?: string
  limit: number
  windowMs: number
}

export interface WindowRateLimitStatus {
  limit: number
  remaining: number
  resetAt: Date
}

export async function getIpWindowRateLimitStatus(
  request: Request,
  options: WindowRateLimitOptions,
): Promise<WindowRateLimitStatus> {
  const ip = getClientIp(request)
  const identifier = options.keyPrefix ? `${options.keyPrefix}:${ip}` : ip
  const now = Date.now()
  const windowStart = new Date(
    Math.floor(now / options.windowMs) * options.windowMs,
  )
  const resetAt = new Date(windowStart.getTime() + options.windowMs)

  const [existingRecord] = await db
    .select({ requestCount: mcpRateLimits.requestCount })
    .from(mcpRateLimits)
    .where(
      and(
        eq(mcpRateLimits.identifier, identifier),
        eq(mcpRateLimits.windowStart, windowStart),
      ),
    )
    .limit(1)

  const currentCount = existingRecord?.requestCount ?? 0

  return {
    limit: options.limit,
    remaining: Math.max(0, options.limit - currentCount),
    resetAt,
  }
}

export async function checkIpWindowRateLimit(
  request: Request,
  options: WindowRateLimitOptions,
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const identifier = options.keyPrefix ? `${options.keyPrefix}:${ip}` : ip
  return checkWindowRateLimit(identifier, 'ip', options)
}

export async function checkUserWindowRateLimit(
  userId: string,
  options: WindowRateLimitOptions,
): Promise<RateLimitResult> {
  const identifier = options.keyPrefix
    ? `${options.keyPrefix}:${userId}`
    : userId
  return checkWindowRateLimit(identifier, 'user', options)
}

async function checkWindowRateLimit(
  identifier: string,
  identifierType: 'ip' | 'user',
  options: WindowRateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = new Date(
    Math.floor(now / options.windowMs) * options.windowMs,
  )
  const resetAt = new Date(windowStart.getTime() + options.windowMs)

  const result = await db
    .insert(mcpRateLimits)
    .values({
      identifier,
      identifierType,
      requestCount: 1,
      windowStart,
    })
    .onConflictDoUpdate({
      target: [mcpRateLimits.identifier, mcpRateLimits.windowStart],
      set: {
        requestCount: sql`${mcpRateLimits.requestCount} + 1`,
      },
    })
    .returning({ requestCount: mcpRateLimits.requestCount })

  const currentCount = result[0]?.requestCount ?? 1
  const remaining = Math.max(0, options.limit - currentCount)
  const allowed = currentCount <= options.limit

  const headers = new Headers()
  headers.set('X-RateLimit-Limit', options.limit.toString())
  headers.set('X-RateLimit-Remaining', remaining.toString())
  headers.set(
    'X-RateLimit-Reset',
    Math.floor(resetAt.getTime() / 1000).toString(),
  )

  if (!allowed) {
    headers.set(
      'Retry-After',
      Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString(),
    )
  }

  return {
    allowed,
    headers,
    remaining,
    resetAt,
  }
}

// Preset rate limits for different endpoint types
export const RATE_LIMITS = {
  // Application starter prompt generation: 12 requests/minute
  applicationStarter: { limitPerMinute: 12, keyPrefix: 'application-starter' },
  // Anonymous starter generations before login is required
  applicationStarterAnonymousDaily: {
    keyPrefix: 'application-starter-anon-day',
    limit: 1_000_000,
    windowMs: 24 * 60 * 60 * 1000,
  },
  // Application Starter remote loading: 30 requests/minute
  applicationStarterRemote: {
    limitPerMinute: 30,
    keyPrefix: 'application-starter-remote',
  },
  // Application Starter compile: 60 requests/minute
  applicationStarterCompile: {
    limitPerMinute: 60,
    keyPrefix: 'application-starter-compile',
  },
  // Deploy endpoint: 10 requests/minute (more sensitive)
  deploy: { limitPerMinute: 10, keyPrefix: 'deploy' },
  // CLI auth ticket creation: public endpoint polled by local tools
  cliAuthTicket: { limitPerMinute: 20, keyPrefix: 'cli-auth-ticket' },
  builderProjectWrite: {
    limitPerMinute: 10,
    keyPrefix: 'builder-project-write',
  },
  builderProjectCreateDaily: {
    keyPrefix: 'builder-project-create-day',
    limit: 100,
    windowMs: 24 * 60 * 60 * 1000,
  },
  builderProjectSave: {
    limitPerMinute: 30,
    keyPrefix: 'builder-project-save',
  },
  builderProjectList: {
    limitPerMinute: 30,
    keyPrefix: 'builder-project-list',
  },
  builderProjectSyncStream: {
    limitPerMinute: 180,
    keyPrefix: 'builder-project-sync-stream',
  },
  builderProjectSyncStreamIp: {
    limitPerMinute: 1_000,
    keyPrefix: 'builder-project-sync-stream-ip',
  },
  builderProjectSyncSnapshotPage: {
    limitPerMinute: 6_000,
    keyPrefix: 'builder-project-sync-snapshot-page',
  },
  builderProjectSyncSnapshotPageIp: {
    limitPerMinute: 20_000,
    keyPrefix: 'builder-project-sync-snapshot-page-ip',
  },
  builderProjectSyncCommand: {
    limitPerMinute: 180,
    keyPrefix: 'builder-project-sync-command',
  },
  builderProjectSyncCommandIp: {
    limitPerMinute: 1_000,
    keyPrefix: 'builder-project-sync-command-ip',
  },
  builderAi: {
    limitPerMinute: 12,
    keyPrefix: 'builder-ai',
  },
  builderAiAuth: {
    limitPerMinute: 30,
    keyPrefix: 'builder-ai-auth',
  },
} as const

function createRateLimitHeaders(
  limit: number,
  result: {
    allowed: boolean
    remaining: number
    resetAt: Date
  },
) {
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set(
    'X-RateLimit-Reset',
    Math.floor(result.resetAt.getTime() / 1000).toString(),
  )
  if (!result.allowed) {
    headers.set(
      'Retry-After',
      Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString(),
    )
  }
  return headers
}
