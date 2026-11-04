import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  jsonError,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import { getMcpEnvironment } from './mcp-environment.server'
import { b64, hash, seal } from './crypto'
import {
  readKodyOauthClient,
  saveKodyOauthClient,
  saveKodyOauthPending,
} from './kody-oauth-store'

/** Original Kody PKCE connection flow, using the shared TanStack identity. */
export async function handleKodyConnect(request: Request): Promise<Response> {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  const invalidOrigin = validateSameOriginRequest(request)
  if (invalidOrigin)
    return jsonError(invalidOrigin.message, invalidOrigin.status)
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  const env = await getMcpEnvironment()
  const host = await getHostRuntimeEnv()
  const configuredOrigin = host?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
  if (typeof configuredOrigin !== 'string' || !configuredOrigin)
    return jsonError('Kody is not configured.', 503)
  const origin = new URL(configuredOrigin).origin
  const url = new URL(request.url)
  const redirectUri = `${url.origin}/api/chat/kody/callback`
  let clientId = await readKodyOauthClient(url.origin)
  if (!clientId) {
    const response = await fetch(`${origin}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'TanChat',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'openid profile email',
      }),
    })
    if (!response.ok)
      throw new Error('Kody could not register this app. Please try again.')
    const registered = z
      .object({ client_id: z.string().min(1) })
      .parse(await response.json())
    clientId = await saveKodyOauthClient(url.origin, registered.client_id)
  }
  if (!clientId) throw new Error('Missing OAuth client id')
  const state = crypto.randomUUID()
  const verifier = b64(crypto.getRandomValues(new Uint8Array(32)))
  const nonce = crypto.randomUUID()
  await saveKodyOauthPending({
    stateHash: await hash(state),
    userId: user.userId,
    payload: await seal(
      {
        verifier,
        nonce,
        clientId,
        redirectUri,
        mode: 'connect',
        userId: user.userId,
        popup: url.searchParams.get('popup') === '1',
        popupChannel: z
          .uuid()
          .optional()
          .catch(undefined)
          .parse(url.searchParams.get('popupChannel') ?? undefined),
      },
      env.ENCRYPTION_KEY,
    ),
    expiresAt: Date.now() + 600000,
  })
  const target = new URL(`${origin}/oauth/authorize`)
  target.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    resource: `${origin}/mcp`,
    state,
    nonce,
    code_challenge: await hash(verifier),
    code_challenge_method: 'S256',
  }).toString()
  // The normal Kody login supports 2FA, unlike its inline OAuth password form.
  const login = new URL(`${origin}/login`)
  login.searchParams.set('redirectTo', `${target.pathname}${target.search}`)
  return new Response(null, {
    status: 302,
    headers: {
      Location: login.href,
      'Set-Cookie': `tanchat_kody_oauth=${state}; Path=/api/chat/kody; HttpOnly; SameSite=Lax; Max-Age=600${url.protocol === 'https:' ? '; Secure' : ''}`,
    },
  })
}
