/**
 * Shared helpers for the public Intent registry API (/api/v1/intent/*).
 *
 * Handles auth-aware rate limiting and response shaping so each route handler
 * stays a thin wrapper around the underlying server functions / DB helpers.
 */

import {
  RATE_LIMITS,
  checkIpRateLimit,
  checkTokenRateLimit,
  rateLimitedResponse,
  type RateLimitResult,
} from './rateLimit.server'
import { validateMcpAuth } from '~/mcp/auth.server'

export interface IntentApiAuth {
  authenticated: boolean
  userId: string | null
}

export interface IntentRateLimitOutcome {
  limited: false
  rl: RateLimitResult
  auth: IntentApiAuth
}

export interface IntentRateLimitedOutcome {
  limited: true
  response: Response
}

export type IntentRateLimitDecision =
  | IntentRateLimitOutcome
  | IntentRateLimitedOutcome

/**
 * Apply rate limiting to a request. If an Authorization: Bearer header is
 * present and valid, uses the higher token-keyed tier. If absent, uses the
 * anonymous IP-keyed tier. If present but invalid, returns 401.
 */
export async function applyIntentRateLimit(
  request: Request,
): Promise<IntentRateLimitDecision> {
  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    const authResult = await validateMcpAuth(authHeader)
    if (!authResult.success) {
      return {
        limited: true,
        response: Response.json(
          { error: authResult.error, code: 'UNAUTHORIZED' },
          { status: authResult.status },
        ),
      }
    }

    const rl = await checkTokenRateLimit(
      authResult.keyId,
      RATE_LIMITS.intentApiAuthed,
    )
    if (!rl.allowed) return { limited: true, response: rateLimitedResponse(rl) }
    return {
      limited: false,
      rl,
      auth: { authenticated: true, userId: authResult.userId },
    }
  }

  const rl = await checkIpRateLimit(request, RATE_LIMITS.intentApi)
  if (!rl.allowed) return { limited: true, response: rateLimitedResponse(rl) }
  return {
    limited: false,
    rl,
    auth: { authenticated: false, userId: null },
  }
}

/**
 * Build a JSON response that merges rate-limit headers and standard
 * Cache-Control for the public read endpoints.
 */
export function intentJsonResponse(
  body: unknown,
  rl: RateLimitResult,
  init?: { status?: number; cache?: boolean },
): Response {
  const headers = new Headers(rl.headers)
  headers.set('Content-Type', 'application/json')
  if (init?.cache !== false) {
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300')
  }
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers,
  })
}

/**
 * CDN URLs for raw skill content. The skill file lives at
 * `package/skills/{skillPath}/SKILL.md` inside the npm tarball; unpkg/jsdelivr
 * serve it at `/{name}@{version}/skills/{skillPath}/SKILL.md`.
 *
 * Both URLs point at immutable, content-addressable npm tarball contents and
 * are heavily edge-cached. Callers should verify integrity using `contentHash`.
 */
export interface SkillContentUrls {
  unpkg: string
  jsdelivr: string
}

export function buildSkillContentUrls(
  packageName: string,
  version: string,
  skillPath: string | null,
): SkillContentUrls | null {
  if (!skillPath) return null
  const path = `${packageName}@${version}/skills/${skillPath}/SKILL.md`
  return {
    unpkg: `https://unpkg.com/${path}`,
    jsdelivr: `https://cdn.jsdelivr.net/npm/${path}`,
  }
}

export function intentErrorResponse(
  error: string,
  code: string,
  status: number,
  rl?: RateLimitResult,
): Response {
  const headers = new Headers(rl?.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers,
  })
}
