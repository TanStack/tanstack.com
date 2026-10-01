import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { CredentialEnv } from './credentials'
import type { McpEgressEnvironment } from './mcp-public-fetch'
import { McpAccounts } from './mcp-accounts'
import { McpAccountError, type McpAccountScope } from './mcp-account-contract'
import { McpSetups, mcpClientMetadata } from './mcp-setup'
import { checkMcpAccount } from './mcp-account-runtime'
import { McpAuthorizationError } from './mcp-auth-network'
import { hash } from './crypto'

const response = (value: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...Object.fromEntries(new Headers(headers)),
    },
  })
async function body(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 32 * 1024)
    throw new McpAuthorizationError(
      'This connection request is too large.',
      413,
    )
  const reader = request.body?.getReader()
  if (!reader) return {}
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.byteLength
    if (size > 32 * 1024) {
      await reader.cancel()
      throw new McpAuthorizationError(
        'This connection request is too large.',
        413,
      )
    }
    chunks.push(part.value)
  }
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(data)) as unknown
  } catch {
    throw new McpAuthorizationError('The connection request is invalid.')
  }
}
/** Called only after the normal API's session, origin and workspace checks. */
export async function mcpAccountApi(
  request: Request,
  env: CredentialEnv & McpEgressEnvironment,
  scope: McpAccountScope,
  path: string,
  fixture = false,
): Promise<Response | undefined> {
  if (path === 'mcp/accounts') {
    const accounts = new McpAccounts(env, scope)
    if (request.method === 'GET')
      return response({ items: await accounts.list() })
    if (request.method === 'POST') {
      if (fixture)
        throw new McpAuthorizationError('Connect services in live mode.')
      return response(await accounts.command(await body(request)))
    }
  }
  const check = path.match(/^mcp\/accounts\/([^/]+)\/check$/)
  if (check && request.method === 'POST') {
    if (fixture)
      throw new McpAuthorizationError('Check live services in live mode.')
    const input = z
      .object({ expectedRevision: z.number().int().positive() })
      .strict()
      .parse(await body(request))
    return response(
      await checkMcpAccount(
        env,
        scope,
        z.string().uuid().parse(check[1]),
        input.expectedRevision,
        { signal: request.signal },
      ),
    )
  }
  if (path === 'mcp/setup' && request.method === 'POST') {
    if (fixture)
      throw new McpAuthorizationError('Connect services in live mode.')
    return response(
      await new McpSetups(env, scope).prepare(
        await body(request),
        new URL(request.url).origin,
        request.signal,
      ),
    )
  }
  const setup = path.match(/^mcp\/setup\/([^/]+)(\/start)?$/)
  if (setup) {
    const id = z.string().uuid().parse(setup[1]),
      service = new McpSetups(env, scope)
    if (request.method === 'GET' && !setup[2])
      return response(await service.get(id))
    if (request.method === 'POST' && setup[2]) {
      if (fixture)
        throw new McpAuthorizationError('Connect services in live mode.')
      const result = await service.start(id, request)
      return response(
        result.summary,
        200,
        result.cookie ? { 'Set-Cookie': result.cookie } : undefined,
      )
    }
  }
}

export async function mcpOAuthRoute(
  request: Request,
  env: CredentialEnv & McpEgressEnvironment,
): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === '/auth/mcp/client-metadata' && request.method === 'GET')
    return response({
      ...mcpClientMetadata(url.origin),
      client_id: url.origin + '/auth/mcp/client-metadata',
    })
  if (url.pathname !== '/auth/mcp/callback' || request.method !== 'GET')
    return response({ error: 'Not found.' }, 404)
  const user = await getAuthService().getCurrentUser(request)
  if (!user)
    return response(
      { error: 'Sign in to TanChat, then start a new connection attempt.' },
      401,
    )
  if (!(await hasChatAccess(user)))
    return response({ error: 'Chat access is unavailable.' }, 403)
  const states = url.searchParams.getAll('state')
  if (states.length !== 1 || !states[0] || states[0].length > 200)
    return response({ error: 'The sign-in response is invalid.' }, 400)
  const stateHash = await hash(states[0])
  const [row] = await db.execute<{ id: string; workspace_id: string }>(
    sql`SELECT id,workspace_id FROM chat_mcp_setup_attempts WHERE state_hash=${stateHash} AND user_id=${user.userId}`,
  )
  if (!row)
    return response(
      { error: 'This sign-in response has expired or was already used.' },
      400,
    )
  try {
    const result = await new McpSetups(env, {
      userId: user.userId,
      workspaceId: row.workspace_id,
    }).callback(row.id, request)
    return new Response(null, {
      status: 303,
      headers: {
        Location: result.location,
        'Set-Cookie': result.cookie,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (
      error instanceof McpAuthorizationError ||
      error instanceof McpAccountError
    )
      return response({ error: error.message }, error.status)
    return response(
      {
        error:
          'Sign-in could not be completed. Start a new connection attempt.',
      },
      400,
    )
  }
}
