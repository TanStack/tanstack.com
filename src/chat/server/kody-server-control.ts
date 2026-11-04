import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatWorkspaces, chatMemberships, chatKodyLinks } from '~/db/schema'
import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import type {
  KodyServerCheck,
  KodyServerEnabled,
  KodyServerReconnect,
} from '../core/kody-servers'
import { policySchema } from '../core/types'
import { assertCompleteKodyResult, KodyConnectionError, kodyCall } from './kody'

export class KodyServerError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
    this.name = 'KodyServerError'
  }
}

const readCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const value = await kody.mcpServerList({})
  const server = value.servers.find(item => item.id === params.id)
  return server ? { id: server.id, name: server.name, enabled: server.enabled, connected: server.connected, state: server.state, updatedAt: server.updatedAt, authUrl: server.authUrl, error: server.error } : null
}`
const reconnectCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  return await kody.mcpServerReconnect({ server: params.id })
}`
const checkCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  return await kody.mcpServerRefresh({ server: params.id })
}`
const setEnabledCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  return await kody.mcpServerSetEnabled({ server: params.id, enabled: params.enabled })
}`
const serverSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  connected: z.boolean(),
  state: z.string(),
  updatedAt: z.string(),
  authUrl: z.string().nullish(),
  error: z.string().nullish(),
})
const reconnectSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  authUrl: z.string().nullish(),
  error: z.string().nullish(),
})
const checkResultSchema = reconnectSchema.omit({ authUrl: true })
const enabledResultSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  enabled: z.boolean(),
})
const envelopeSchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.object({ result: z.unknown() }).optional(),
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

async function callServer(
  call: typeof kodyCall,
  env: KodyEnvironment,
  userId: string,
  code: string,
  id: string,
  signal?: AbortSignal,
) {
  try {
    const raw = envelopeSchema.parse(
      await call(
        env,
        userId,
        'execute',
        { code, params: { id }, responseLimit: 4000 },
        signal,
      ),
    )
    if (raw.isError || !raw.structuredContent)
      throw new KodyServerError('Kody could not confirm this connection.', 502)
    return raw.structuredContent.result
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyServerError(error.message, 401)
    throw new KodyServerError('Kody could not confirm this connection.', 502)
  }
}

async function binding(
  env: KodyEnvironment,
  workspaceId: string,
  userId: string,
) {
  const [stored] = await db
    .select({ policy: chatWorkspaces.policy, subject: chatKodyLinks.subject })
    .from(chatWorkspaces)
    .innerJoin(
      chatMemberships,
      eq(chatMemberships.workspaceId, chatWorkspaces.id),
    )
    .innerJoin(chatKodyLinks, eq(chatKodyLinks.userId, chatMemberships.userId))
    .where(
      and(
        eq(chatWorkspaces.id, workspaceId),
        eq(chatMemberships.userId, userId),
      ),
    )
  const row = stored
    ? { policy: JSON.stringify(stored.policy), subject: stored.subject }
    : undefined
  if (!row) throw new KodyServerError('Kody is unavailable here.', 403)
  try {
    if (!policySchema.parse(JSON.parse(row.policy)).allowKody)
      throw new KodyServerError('Kody is unavailable here.', 403)
  } catch {
    throw new KodyServerError('Kody is unavailable here.', 403)
  }
  return row
}

async function readServer(
  call: typeof kodyCall,
  env: KodyEnvironment,
  userId: string,
  id: string,
  signal?: AbortSignal,
) {
  try {
    return serverSchema
      .nullable()
      .parse(await callServer(call, env, userId, readCode, id, signal))
  } catch (error) {
    if (error instanceof KodyServerError) throw error
    throw new KodyServerError(
      'Kody did not return the full connection state.',
      502,
    )
  }
}

async function checkedBinding(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  before: { subject: string; policy: string },
) {
  const after = await binding(env, scope.workspaceId, scope.userId)
  if (after.subject !== before.subject || after.policy !== before.policy)
    throw new KodyServerError('Kody access changed. Refresh and try again.')
}

/** Recheck the exact saved server before attempting Kody's idempotent reconnect. */
export async function reconnectKodyServer(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  id: string,
  change: KodyServerReconnect,
  signal?: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const before = await binding(env, scope.workspaceId, scope.userId)
  const current = await readServer(call, env, scope.userId, id, signal)
  if (!current || current.id !== id || current.name !== change.expected.name)
    throw new KodyServerError(
      'This connection changed in Kody. Refresh and try again.',
    )
  if (current.connected)
    return {
      id,
      name: current.name,
      state: current.state,
      connected: true,
      authUrl: undefined,
      error: undefined,
      changed: false,
    }
  if (!current.enabled)
    throw new KodyServerError('This connection is disabled in Kody.')
  if (current.updatedAt !== change.expected.updatedAt)
    throw new KodyServerError(
      'This connection changed in Kody. Refresh and try again.',
    )
  await checkedBinding(env, scope, before)
  let result: z.infer<typeof reconnectSchema>
  try {
    result = reconnectSchema.parse(
      await callServer(call, env, scope.userId, reconnectCode, id, signal),
    )
  } catch (error) {
    if (error instanceof KodyServerError) throw error
    throw new KodyServerError('Kody did not confirm this connection.', 502)
  }
  if (result.id !== id || result.name !== current.name)
    throw new KodyServerError('Kody did not confirm the same connection.', 502)
  return {
    id,
    name: result.name,
    state: result.state,
    connected: result.state === 'ready',
    authUrl: safeAuthUrl(result.authUrl),
    error: result.error?.slice(0, 500),
    changed: true,
  }
}

/** Ask Kody to verify a connected server and re-discover its current tools. */
export async function checkKodyServer(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  id: string,
  change: KodyServerCheck,
  signal?: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const before = await binding(env, scope.workspaceId, scope.userId)
  const current = await readServer(call, env, scope.userId, id, signal)
  if (!current || current.id !== id || current.name !== change.expected.name)
    throw new KodyServerError(
      'This connection changed in Kody. Refresh and try again.',
    )
  if (!current.enabled)
    throw new KodyServerError('This connection is disabled in Kody.')
  if (!current.connected)
    return {
      id,
      name: current.name,
      state: current.state,
      connected: false,
      error: current.error?.slice(0, 500),
      changed: false,
    }
  if (current.updatedAt !== change.expected.updatedAt)
    throw new KodyServerError(
      'This connection changed in Kody. Refresh and try again.',
    )
  await checkedBinding(env, scope, before)
  let result: z.infer<typeof checkResultSchema>
  try {
    result = checkResultSchema.parse(
      await callServer(call, env, scope.userId, checkCode, id, signal),
    )
  } catch (error) {
    if (error instanceof KodyServerError) throw error
    throw new KodyServerError(
      'Kody did not confirm this connection check.',
      502,
    )
  }
  if (result.id !== id || result.name !== current.name)
    throw new KodyServerError('Kody did not confirm the same connection.', 502)
  return {
    id,
    name: result.name,
    state: result.state,
    connected: result.state === 'ready',
    error: result.error?.slice(0, 500),
    changed: true,
  }
}

/** Change only the exact saved Kody server seen in Connections. */
export async function setKodyServerEnabled(
  env: KodyEnvironment,
  scope: { workspaceId: string; userId: string },
  id: string,
  change: KodyServerEnabled,
  signal?: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const before = await binding(env, scope.workspaceId, scope.userId)
  const current = await readServer(call, env, scope.userId, id, signal)
  if (!current || current.id !== id || current.name !== change.expected.name)
    throw new KodyServerError(
      'This connection changed in Kody. Refresh and try again.',
    )
  if (current.enabled === change.enabled) {
    await checkedBinding(env, scope, before)
    return { id, name: current.name, enabled: current.enabled, changed: false }
  }
  if (
    current.enabled !== change.expected.enabled ||
    current.updatedAt !== change.expected.updatedAt
  )
    throw new KodyServerError(
      'This connection changed in Kody. Refresh and try again.',
    )
  await checkedBinding(env, scope, before)
  try {
    const raw = await call(
      env,
      scope.userId,
      'execute',
      {
        code: setEnabledCode,
        params: { id, enabled: change.enabled },
        idempotencyKey: `banks-kody-server-enabled-${change.operationId}`,
        responseLimit: 4000,
      },
      signal,
    )
    assertCompleteKodyResult(raw)
    const envelope = envelopeSchema.parse(raw)
    if (envelope.isError || !envelope.structuredContent)
      throw new KodyServerError('Kody did not confirm this change.', 502)
    const result = enabledResultSchema.parse(envelope.structuredContent.result)
    if (
      result.id !== id ||
      result.name !== current.name ||
      result.enabled !== change.enabled
    )
      throw new KodyServerError('Kody confirmed a different connection.', 502)
    await checkedBinding(env, scope, before)
    return { ...result, changed: true }
  } catch (error) {
    // The reply may be lost after Kody saves the new state.
    const saved = await readServer(call, env, scope.userId, id, signal).catch(
      () => null,
    )
    await checkedBinding(env, scope, before)
    if (
      saved?.id === id &&
      saved.name === current.name &&
      saved.enabled === change.enabled
    )
      return { id, name: saved.name, enabled: saved.enabled, changed: true }
    if (error instanceof KodyConnectionError)
      throw new KodyServerError(error.message, 401)
    throw new KodyServerError('Kody did not confirm this change.', 502)
  }
}
