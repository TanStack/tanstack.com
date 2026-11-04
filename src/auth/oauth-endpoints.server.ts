import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { timingSafeEqual } from 'node:crypto'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { eq } from 'drizzle-orm'
import { envFunctions } from '~/utils/env.functions'
import { readTextBody } from '~/utils/api-boundary.server'
import {
  introspectSourceToken,
  revokeOAuthGrant,
  validateOAuthToken,
  verifiedGitHubIdentity,
} from './oauthClient.server'
import { IDENTITY_RESOURCE, SOURCE_RESOURCE } from './oauth-resources'

const headers = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'Access-Control-Allow-Origin': '*',
}
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers })

async function form(request: Request) {
  if (
    !request.headers
      .get('content-type')
      ?.startsWith('application/x-www-form-urlencoded')
  )
    return null
  const result = await readTextBody(request, 16 * 1024)
  return result.success ? new URLSearchParams(result.text) : null
}

export async function handleIntrospection(request: Request) {
  const host = await getHostRuntimeEnv()
  const runtimeSecret = host?.TANSTACK_SOURCE_INTROSPECTION_SECRET
  const secret =
    typeof runtimeSecret === 'string'
      ? runtimeSecret
      : envFunctions.TANSTACK_SOURCE_INTROSPECTION_SECRET
  const authorization = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (
    !secret ||
    Buffer.byteLength(authorization) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))
  )
    return json({ error: 'invalid_client' }, 401)
  const params = await form(request)
  if (
    !params ||
    params.get('resource') !== SOURCE_RESOURCE ||
    !params.get('token')
  )
    return json({ error: 'invalid_request' }, 400)
  return json(await introspectSourceToken(params.get('token') ?? ''))
}

export async function handleUserInfo(request: Request) {
  const match = /^Bearer ([^\s]+)$/.exec(
    request.headers.get('authorization') ?? '',
  )
  if (!match) return json({ error: 'invalid_token' }, 401)
  const result = await validateOAuthToken(match[1], IDENTITY_RESOURCE)
  if (!result.success || result.scope !== 'identity')
    return json({ error: 'invalid_token' }, 401)
  const [person] = await db
    .select({
      sub: users.id,
      email: users.email,
      name: users.name,
      preferred_username: users.displayUsername,
    })
    .from(users)
    .where(eq(users.id, result.userId))
    .limit(1)
  if (!person) return json({ error: 'invalid_token' }, 401)
  return json({
    ...person,
    github_id: await verifiedGitHubIdentity(result.userId),
  })
}

export async function handleRevocation(request: Request) {
  const params = await form(request)
  if (!params?.get('token') || !params.get('client_id'))
    return json({ error: 'invalid_request' }, 400)
  await revokeOAuthGrant(
    params.get('token') ?? '',
    params.get('client_id') ?? '',
  )
  return new Response(null, { status: 200, headers })
}

export const oauthOptions = () =>
  new Response(null, {
    status: 204,
    headers: {
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
