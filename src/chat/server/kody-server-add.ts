import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  kodyServerAddResultSchema,
  kodyServerAddSchema,
  type KodyServerAdd,
} from '../core/kody-servers'
import { assertCompleteKodyResult, KodyConnectionError, kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

export class KodyServerAddError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
    this.name = 'KodyServerAddError'
  }
}

export const KODY_SERVER_ADD_LOOKUP_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const result = await kody.mcpServerList({})
  if (!Array.isArray(result?.servers)) throw new Error('Unsupported Kody server list')
  const server = result.servers.find(item => item.name === params.name)
  if (!server) return null
  return {
    id: server.id,
    name: server.name,
    url: server.url,
    state: server.state,
    connected: server.connected,
    toolCount: server.toolCount,
    authUrl: server.authUrl,
    error: server.error,
  }
}`

export const KODY_SERVER_ADD_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const result = await kody.mcpServerAdd({ name: params.name, url: params.url })
  return {
    id: result.id,
    name: result.name,
    url: result.url,
    state: result.state,
    connected: result.state === 'ready',
    toolCount: result.toolCount,
    authUrl: result.authUrl,
    error: result.error,
  }
}`

const serverSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  url: z.url(),
  state: z.string(),
  connected: z.boolean(),
  toolCount: z.number().int().nonnegative(),
  authUrl: z.string().nullish(),
  error: z.string().nullish(),
})

function safeAuthUrl(value: string | null | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function sameUrl(left: string, right: string) {
  return new URL(left).href === new URL(right).href
}

function confirmedServer(raw: unknown, name: string, url: string) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyServerAddError('Kody did not confirm this server.', 502)
  const server = serverSchema.parse(envelope.data.structuredContent.result)
  if (server.name !== name || !sameUrl(server.url, url))
    throw new KodyServerAddError(
      'Kody returned a different server. Check Connections before retrying.',
      502,
    )
  return server
}

async function lookup(
  env: KodyEnvironment,
  userId: string,
  name: string,
  signal: AbortSignal,
  call: typeof kodyCall,
) {
  const raw = await call(
    env,
    userId,
    'execute',
    kodyInternalReadArgs({
      code: KODY_SERVER_ADD_LOOKUP_CODE,
      params: { name },
      responseLimit: 4000,
    }),
    signal,
  )
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyServerAddError(
      'Kody server status could not be checked.',
      502,
    )
  return envelope.data.structuredContent.result == null
    ? null
    : serverSchema.parse(envelope.data.structuredContent.result)
}

function present(server: z.infer<typeof serverSchema>, existing: boolean) {
  return kodyServerAddResultSchema.parse({
    id: server.id,
    name: server.name,
    state: server.state,
    connected: server.connected,
    toolCount: server.toolCount,
    authUrl: safeAuthUrl(server.authUrl),
    error: server.error?.slice(0, 500),
    existing,
  })
}

export async function addKodyServer(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  input: KodyServerAdd,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const request = kodyServerAddSchema.parse(input)
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyServerAddError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody before adding a server.',
      before.reason === 'blocked' ? 403 : 409,
    )
  try {
    const current = await lookup(env, scope.userId, request.name, signal, call)
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    if (current) {
      if (!sameUrl(current.url, request.url))
        throw new KodyServerAddError(
          'A different Kody server already uses this name.',
        )
      return present(current, true)
    }

    let raw: unknown
    try {
      raw = await call(
        env,
        scope.userId,
        'execute',
        {
          code: KODY_SERVER_ADD_CODE,
          params: { name: request.name, url: request.url },
          idempotencyKey: `banks-kody-server-add-${request.operationId}`,
          responseLimit: 4000,
        },
        signal,
      )
      assertCompleteKodyResult(raw)
      const added = confirmedServer(raw, request.name, request.url)
      await assertKodyReferenceAccountUnchanged(env, scope, options, before)
      return present(added, false)
    } catch (error) {
      if (error instanceof KodyServerAddError && error.status === 409)
        throw error
      // A lost response may follow a successful add. Re-read Kody before
      // reporting an uncertain outcome or asking the person to retry.
      const saved = await lookup(
        env,
        scope.userId,
        request.name,
        signal,
        call,
      ).catch(() => null)
      await assertKodyReferenceAccountUnchanged(env, scope, options, before)
      if (saved) {
        if (!sameUrl(saved.url, request.url))
          throw new KodyServerAddError(
            'A different Kody server now uses this name.',
          )
        return present(saved, true)
      }
      throw new KodyServerAddError(
        'Kody did not confirm this server. Check Connections before retrying this request.',
        502,
      )
    }
  } catch (error) {
    if (error instanceof KodyServerAddError) throw error
    if (error instanceof KodyConnectionError)
      throw new KodyServerAddError(error.message, 409)
    throw new KodyServerAddError('Kody server setup could not be checked.', 502)
  }
}
