import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { db } from '~/db/client'
import { chatKodyLinks } from '~/db/schema'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { jsonError } from '~/utils/api-boundary.server'
import { getModelEnvironment } from './model-environment.server'
import { hash, unseal } from './crypto'
import { consumeKodyOauthPending } from './kody-oauth-store'
import { updateCredentials } from './credentials'
import { authPopupComplete } from './auth-popup'
import { syncConnectedKodyAccount } from './kody-connected-sync.server'

const pendingSchema = z.object({
  verifier: z.string(),
  nonce: z.string(),
  clientId: z.string(),
  redirectUri: z.string().url(),
  mode: z.literal('connect'),
  userId: z.string(),
  popup: z.boolean(),
  popupChannel: z.uuid().optional(),
})
const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  id_token: z.string().min(1),
})

export async function handleKodyCallback(request: Request): Promise<Response> {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
  const user = await getAuthService().getCurrentUser(request)
  if (!user)
    return jsonError(
      'Sign in to the account that started this connection.',
      401,
    )
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  const url = new URL(request.url)
  const host = await getHostRuntimeEnv()
  const configuredOrigin = host?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
  if (typeof configuredOrigin !== 'string' || !configuredOrigin)
    return jsonError('Kody is not configured.', 503)
  const origin = new URL(configuredOrigin).origin
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('tanchat_kody_oauth='))
    ?.slice('tanchat_kody_oauth='.length)
  if (
    !state ||
    state !== cookie ||
    !code ||
    url.searchParams.get('iss') !== origin
  )
    return jsonError(
      'Sign-in expired or was declined. Return to the app and try again.',
      400,
    )
  const encrypted = await consumeKodyOauthPending(
    await hash(state),
    user.userId,
  )
  if (!encrypted) return jsonError('Sign-in expired.', 400)
  const env = await getModelEnvironment()
  const data = pendingSchema.parse(
    await unseal<unknown>(encrypted, env.ENCRYPTION_KEY),
  )
  if (
    data.userId !== user.userId ||
    data.redirectUri !== `${url.origin}/api/chat/kody/callback`
  )
    return jsonError(
      'Sign in to the account that started this connection.',
      403,
    )
  const response = await fetch(`${origin}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: data.redirectUri,
      client_id: data.clientId,
      code_verifier: data.verifier,
      resource: `${origin}/mcp`,
    }),
  })
  if (!response.ok) throw new Error('Kody sign-in failed. Please try again.')
  const tokens = tokensSchema.parse(await response.json())
  const { payload } = await jwtVerify(
    tokens.id_token,
    createRemoteJWKSet(new URL(`${origin}/.well-known/jwks.json`)),
    { issuer: origin, audience: data.clientId, algorithms: ['RS256'] },
  )
  if (
    payload.nonce !== data.nonce ||
    !payload.sub ||
    payload.email_verified !== true
  )
    return jsonError('A verified Kody account is required.', 403)
  if (
    !z.string().trim().toLowerCase().email().max(254).safeParse(payload.email)
      .success
  )
    return jsonError('A verified Kody email is required.', 403)
  const [owner] = await db
    .select()
    .from(chatKodyLinks)
    .where(eq(chatKodyLinks.subject, payload.sub))
  const [link] = await db
    .select()
    .from(chatKodyLinks)
    .where(eq(chatKodyLinks.userId, user.userId))
  if (
    (owner && owner.userId !== user.userId) ||
    (link && link.subject !== payload.sub)
  )
    return jsonError(
      'This account is already linked. Reconnect the original Kody account.',
      409,
    )
  const username =
    typeof payload.preferred_username === 'string'
      ? payload.preferred_username
      : ''
  // Both unique constraints arbitrate competing links without an exception.
  await db
    .insert(chatKodyLinks)
    .values({ userId: user.userId, subject: payload.sub, username })
    .onConflictDoNothing()
  const [linked] = await db
    .update(chatKodyLinks)
    .set({ username })
    .where(
      and(
        eq(chatKodyLinks.userId, user.userId),
        eq(chatKodyLinks.subject, payload.sub),
      ),
    )
    .returning({ subject: chatKodyLinks.subject })
  if (linked?.subject !== payload.sub)
    return jsonError('Reconnect the original Kody account.', 409)
  await updateCredentials(env, user.userId, (existing) => ({
    ...existing,
    kody: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      client_id: data.clientId,
    },
    connection: existing?.connection ?? {
      provider: 'included',
      model: env.INCLUDED_MODEL,
      baseUrl: '',
      accountId: '',
      gatewayId: '',
    },
  }))
  await syncConnectedKodyAccount(user.userId)
  const headers = new Headers({
    Location: '/chat',
    'Set-Cookie': `tanchat_kody_oauth=; Path=/api/chat/kody; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}`,
  })
  if (data.popup) return authPopupComplete(headers, data.popupChannel)
  return new Response(null, { status: 303, headers })
}
