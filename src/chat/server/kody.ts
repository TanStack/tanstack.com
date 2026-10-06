import { mcpCall, type McpConnection } from './mcp'
import { readCredentials, updateCredentials } from './credentials'
import { hash } from './crypto'
import type { Tokens } from '../core/types'
import type { CredentialEnv } from './credentials'
import { sql } from 'drizzle-orm'
import { db } from '~/db/client'

export interface KodyEnvironment extends CredentialEnv {
  KODY_ORIGIN: string
}

export class KodyConnectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KodyConnectionError'
  }
}

const refreshAhead = 60_000
const refreshLease = 20_000
const refreshWait = 15_000
const refreshPoll = 200

function currentToken(tokens: Tokens) {
  return tokens.expires_at >= Date.now() + refreshAhead
}

async function tokenFingerprint(tokens: Tokens) {
  return hash(
    JSON.stringify([
      tokens.client_id,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_at,
    ]),
  )
}

/** Local status only. Bootstrap must not spend a refresh token. */
export async function kodyNeedsSignIn(
  env: KodyEnvironment,
  userId: string,
  tokens: Tokens | undefined,
) {
  if (!tokens || currentToken(tokens)) return false
  if (!tokens.refresh_token) return true
  const [state] = await db.execute<{ status: string }>(sql`
    SELECT status FROM chat_kody_refresh_claims
    WHERE user_id=${userId} AND token_fingerprint=${await tokenFingerprint(tokens)}`)
  return state?.status === 'needs_auth'
}

class KodyGrantChanged extends Error {}

async function refreshKodyToken(
  env: KodyEnvironment,
  userId: string,
  tokens: Tokens,
) {
  const fingerprint = await tokenFingerprint(tokens)
  const claimId = crypto.randomUUID()
  const [claimed] = await db.execute(sql`
    INSERT INTO chat_kody_refresh_claims (user_id,token_fingerprint,claim_id,status,lease_until)
    VALUES (${userId},${fingerprint},${claimId},'refreshing',${Date.now() + refreshLease})
    ON CONFLICT(user_id) DO UPDATE SET token_fingerprint=excluded.token_fingerprint,
      claim_id=excluded.claim_id,status='refreshing',lease_until=excluded.lease_until
    WHERE chat_kody_refresh_claims.token_fingerprint<>excluded.token_fingerprint
    RETURNING claim_id`)
  if (!claimed) {
    const deadline = Date.now() + refreshWait
    do {
      const latest = (await readCredentials(env, userId))?.kody
      if (!latest)
        throw new KodyConnectionError('Connect Kody to use its tools.')
      if (currentToken(latest)) return
      const [state] = await db.execute<{
        token_fingerprint: string
        status: string
        lease_until: number
      }>(sql`
        SELECT token_fingerprint,status,lease_until FROM chat_kody_refresh_claims WHERE user_id=${userId}`)
      if (!state || state.token_fingerprint !== fingerprint) return
      if (state.status === 'completed') return
      if (state.status === 'needs_auth')
        throw new KodyConnectionError('Reconnect Kody to continue.')
      if (state.lease_until < Date.now()) {
        await db.execute(sql`UPDATE chat_kody_refresh_claims SET status='needs_auth'
          WHERE user_id=${userId} AND token_fingerprint=${fingerprint} AND status='refreshing' AND lease_until<${Date.now()}`)
        throw new KodyConnectionError('Reconnect Kody to continue.')
      }
      await new Promise((resolve) => setTimeout(resolve, refreshPoll))
    } while (Date.now() < deadline)
    throw new KodyConnectionError('Kody sign-in is renewing. Try again.')
  }
  try {
    const latest = (await readCredentials(env, userId))?.kody
    if (
      !latest ||
      latest.client_id !== tokens.client_id ||
      latest.access_token !== tokens.access_token ||
      latest.refresh_token !== tokens.refresh_token
    )
      throw new KodyGrantChanged()
    const response = await fetch(`${env.KODY_ORIGIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token!,
        client_id: tokens.client_id,
      }),
    })
    if (!response.ok) throw new Error('Kody token refresh failed')
    const refreshed = (await response.json()) as {
      access_token?: unknown
      refresh_token?: unknown
      expires_in?: unknown
    }
    if (
      typeof refreshed.access_token !== 'string' ||
      !refreshed.access_token ||
      (refreshed.refresh_token !== undefined &&
        typeof refreshed.refresh_token !== 'string') ||
      typeof refreshed.expires_in !== 'number' ||
      !Number.isFinite(refreshed.expires_in) ||
      refreshed.expires_in <= refreshAhead / 1000
    )
      throw new Error('Kody returned an invalid token')
    const next: Tokens = {
      ...tokens,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + refreshed.expires_in * 1000,
    }
    await updateCredentials(env, userId, (current) => {
      if (
        !current?.kody ||
        current.kody.client_id !== tokens.client_id ||
        current.kody.access_token !== tokens.access_token ||
        current.kody.refresh_token !== tokens.refresh_token
      )
        throw new KodyGrantChanged()
      return { ...current, kody: next }
    })
    await db.execute(sql`UPDATE chat_kody_refresh_claims SET status='completed'
      WHERE user_id=${userId} AND claim_id=${claimId} AND status='refreshing'`)
  } catch (error) {
    await db.execute(sql`UPDATE chat_kody_refresh_claims SET status=${error instanceof KodyGrantChanged ? 'completed' : 'needs_auth'}
      WHERE user_id=${userId} AND claim_id=${claimId} AND status='refreshing'`)
    if (error instanceof KodyGrantChanged) return
    throw new KodyConnectionError(
      'Your Kody connection expired. Sign in again.',
    )
  }
}

export async function kodyConnection(
  env: KodyEnvironment,
  userId: string,
): Promise<McpConnection> {
  let tokens = (await readCredentials(env, userId))?.kody
  if (!tokens) throw new KodyConnectionError('Connect Kody to use its tools.')
  if (!currentToken(tokens)) {
    if (!tokens.refresh_token)
      throw new KodyConnectionError('Reconnect Kody to continue.')
    await refreshKodyToken(env, userId, tokens)
    tokens = (await readCredentials(env, userId))?.kody
    if (!tokens) throw new KodyConnectionError('Connect Kody to use its tools.')
    if (!currentToken(tokens))
      throw new KodyConnectionError('Kody sign-in is renewing. Try again.')
  }
  return {
    id: 'kody',
    label: 'Kody',
    url: `${env.KODY_ORIGIN}/mcp`,
    accessToken: tokens.access_token,
  }
}
export async function kodyCall(
  env: KodyEnvironment,
  userId: string,
  name: 'search' | 'execute',
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return mcpCall(await kodyConnection(env, userId), name, args, signal)
}

// Kody applies this limit before TanChat can archive a tool result. Keep it above
// the size of ordinary search responses so the full value reaches StoredResults.
export const KODY_ACTION_RESPONSE_LIMIT = 1_000_000

export class KodyResultTruncatedError extends Error {
  constructor() {
    super(
      'Kody ran the action, but its result exceeded the response limit. The outcome needs verification before running it again.',
    )
    this.name = 'KodyResultTruncatedError'
  }
}

export function assertCompleteKodyResult(result: unknown) {
  if (!result || typeof result !== 'object') return
  const envelope = result as {
    structuredContent?: { result?: { truncated?: unknown; type?: unknown } }
    content?: Array<{ type?: unknown; text?: unknown }>
  }
  const placeholder = envelope.structuredContent?.result
  if (
    placeholder?.truncated === true &&
    typeof placeholder.type === 'string' &&
    envelope.content?.some(
      (part) =>
        part.type === 'text' &&
        typeof part.text === 'string' &&
        part.text.includes('--- TRUNCATED ---'),
    )
  )
    throw new KodyResultTruncatedError()
}

export function resultText(result: unknown) {
  if (
    result &&
    typeof result === 'object' &&
    'content' in result &&
    Array.isArray(result.content)
  ) {
    return result.content
      .filter(
        (c): c is { type: 'text'; text: string } =>
          c?.type === 'text' && typeof c.text === 'string',
      )
      .map((c) => c.text)
      .join('\n')
      .slice(0, 24000)
  }
  return JSON.stringify(result).slice(0, 24000)
}
