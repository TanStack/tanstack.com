/**
 * Simple IP-based rate limiting for public API endpoints.
 * Uses the existing MCP rate limit infrastructure.
 */

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
      headers: result.headers,
    },
  )
}

// Preset rate limits for different endpoint types
export const RATE_LIMITS = {
  // Builder remote loading: 30 requests/minute (generous for UX)
  builderRemote: { limitPerMinute: 30, keyPrefix: 'builder-remote' },
  // Builder compile: 60 requests/minute
  builderCompile: { limitPerMinute: 60, keyPrefix: 'builder-compile' },
  // Deploy endpoint: 10 requests/minute (more sensitive)
  deploy: { limitPerMinute: 10, keyPrefix: 'deploy' },
} as const
