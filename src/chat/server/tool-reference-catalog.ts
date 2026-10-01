import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { KodyEnvironment } from './kody'
import type { McpEgressEnvironment } from './mcp-public-fetch'
type ToolReferenceEnvironment = KodyEnvironment & McpEgressEnvironment
import { z } from 'zod'
import { maxPluginMcpServers } from '../core/plugins'
import {
  referenceInputSchema,
  type MessageReference,
  type ReferenceCatalog,
} from '../core/message-references'
import { policySchema, type Policy } from '../core/types'
import { readCredentials } from './credentials'
import { McpAccounts } from './mcp-accounts'
import { McpAccountError } from './mcp-account-contract'
import { hash } from './crypto'
import { fetchMcpCatalog, type ServerCatalog } from './mcp-catalog'
import { connectedMcpServers } from './mcp-connections'
import type { McpConnection } from './mcp'
import { validateMcpEndpoint } from './public-endpoint'
import {
  pluginMcpConnections,
  pluginConnectionIdentity,
} from './plugin-connections'

export class ToolReferenceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'ToolReferenceError'
  }
}
interface Scope {
  workspaceId: string
  userId: string
  botId?: string
}
interface Options {
  policy: Policy
  fixture: boolean
  /** Exact retained alias when resolving or refreshing an existing selection. */
  serverId?: string
}
interface Source {
  connection: McpConnection
  fingerprint: string
}
interface Configuration {
  sources: Source[]
  accountsState: string
  pluginsState: string
  ciphertext: string | null
  kodySubject: string | null
  policyText: string
  policy: Policy
}
interface Snapshot {
  server_id: string
  fingerprint: string
  metadata: string
  fetched_at: number
}
const maxTools = 2000
const maxSnapshotBytes = 1024 * 1024
// 100 private accounts, Kody, and the existing 50-installation package quota.
const maxSources = 101 + 50 * maxPluginMcpServers
const maxCachedSources = 101
const freshFor = 5 * 60_000
const itemSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\p{Cc}\p{Cf}]+$/u),
    label: z.string().min(1).max(200),
    description: z.string().max(2000),
  })
  .strict()
const snapshotSchema = z.array(itemSchema).max(maxTools)
const safeLabel = (value: string) => value.trim().slice(0, 200) || 'Untitled'

async function access(
  env: ToolReferenceEnvironment,
  scope: Scope,
  options: Options,
) {
  const [row] = await db.execute<{ policy: string }>(
    sql`SELECT w.policy::text AS policy FROM chat_workspaces w JOIN chat_memberships a ON a.workspace_id=w.id WHERE w.id=${scope.workspaceId} AND a.user_id=${scope.userId}::uuid AND (${scope.botId ?? null}::text IS NULL OR EXISTS(SELECT 1 FROM chat_bots b WHERE b.id=${scope.botId ?? null} AND b.workspace_id=w.id AND b.deleted_at IS NULL))`,
  )
  if (!row)
    throw new ToolReferenceError('Workspace access is unavailable.', 403)
  let stored: Policy
  try {
    stored = policySchema.parse(JSON.parse(row.policy))
  } catch {
    throw new ToolReferenceError('Workspace policy is unavailable.', 403)
  }
  return {
    policyText: row.policy,
    policy: {
      ...stored,
      allowMcp: stored.allowMcp && options.policy.allowMcp,
      allowKody: stored.allowKody && options.policy.allowKody,
    },
  }
}
const accountsStateSql = (userId: string) =>
  sql`(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,revision,grant_id,enabled,removed,status) ORDER BY id),'[]'::jsonb)::text FROM chat_mcp_accounts WHERE user_id=${userId}::uuid)`
const pluginsStateSql = (scope: Scope) =>
  sql`(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,revision) ORDER BY id),'[]'::jsonb)::text FROM chat_plugin_installations WHERE workspace_id=${scope.workspaceId} AND user_id=${scope.userId}::uuid)`
async function pluginState(_env: ToolReferenceEnvironment, scope: Scope) {
  const [row] = await db.execute<{ state: string }>(
    sql`SELECT ${pluginsStateSql(scope)} AS state`,
  )
  return row.state
}
async function credentialState(_env: ToolReferenceEnvironment, userId: string) {
  const [row] = await db.execute<{
    ciphertext: string | null
    kodySubject: string | null
    accountsState: string
  }>(
    sql`SELECT (SELECT ciphertext FROM chat_credentials WHERE user_id=${userId}::uuid) AS ciphertext,(SELECT subject FROM chat_kody_links WHERE user_id=${userId}::uuid) AS "kodySubject",${accountsStateSql(userId)} AS "accountsState"`,
  )
  return row
}
/** Local only, including expired OAuth credentials. Picker reads never refresh them. */
async function readConfiguration(
  env: ToolReferenceEnvironment,
  scope: Scope,
  options: Options,
): Promise<Configuration> {
  const permission = await access(env, scope, options)
  if (
    options.fixture ||
    (!permission.policy.allowMcp && !permission.policy.allowKody)
  )
    return {
      ...permission,
      sources: [],
      ciphertext: null,
      kodySubject: null,
      accountsState: '[]',
      pluginsState: '[]',
    }
  const accounts = new McpAccounts(env, scope)
  if (permission.policy.allowMcp) await accounts.ensureLegacy()
  const pluginsState = await pluginState(env, scope)
  const before = await credentialState(env, scope.userId)
  const credentials = await readCredentials(env, scope.userId)
  const after = await credentialState(env, scope.userId)
  if (
    after.accountsState !== before.accountsState ||
    after.ciphertext !== before.ciphertext ||
    after.kodySubject !== before.kodySubject
  )
    throw new ToolReferenceError('Connections changed. Try again.', 409)
  const sources: Source[] = []
  if (permission.policy.allowKody && credentials?.kody) {
    try {
      const connection: McpConnection = {
        id: 'kody',
        label: 'Kody',
        url: validateMcpEndpoint(`${env.KODY_ORIGIN}/mcp`),
        accessToken: credentials.kody.access_token,
      }
      sources.push({
        connection,
        fingerprint: await hash(
          JSON.stringify([
            connection.id,
            connection.url,
            // Verified subject is account identity; renewing its bearer token does
            // not replace the account. Unlinked legacy credentials stay conservative.
            before.kodySubject
              ? [
                  'linked-subject',
                  before.kodySubject,
                  credentials.kody.client_id,
                ]
              : ['unlinked-token', credentials.kody],
          ]),
        ),
      })
    } catch {
      /* Invalid stored endpoints are never exposed or refreshed. */
    }
  }
  if (permission.policy.allowMcp) {
    const servers = await accounts.configuredServers()
    for (const server of servers) {
      try {
        const connection: McpConnection = {
          id: `mcp:${server.id}`,
          accountId: server.id,
          label: safeLabel(server.label),
          url: validateMcpEndpoint(server.url),
          accessToken: server.accessToken,
          credentialId: server.credentialId,
        }
        sources.push({
          connection,
          fingerprint: await hash(
            JSON.stringify([
              connection.id,
              connection.url,
              connection.credentialId ?? null,
            ]),
          ),
        })
      } catch {
        /* An invalid stored connection is unavailable. */
      }
    }
    const exact = options.serverId && pluginConnectionIdentity(options.serverId)
    for (const connection of await pluginMcpConnections(env, scope, servers, {
      ...(exact ? { serverId: options.serverId } : {}),
    })) {
      sources.push({
        connection,
        fingerprint: await hash(
          JSON.stringify([
            connection.id,
            connection.url,
            connection.accountId,
            connection.credentialId ?? null,
          ]),
        ),
      })
    }
  }
  if ((await pluginState(env, scope)) !== pluginsState)
    throw new ToolReferenceError('Installed plugins changed. Try again.', 409)
  if (
    sources.length > maxSources ||
    new Set(sources.map((s) => s.connection.id)).size !== sources.length
  )
    throw new ToolReferenceError(
      'The configured tool sources exceed the supported limits or contain duplicate IDs.',
      409,
    )
  if (
    (await credentialState(env, scope.userId)).accountsState !==
    before.accountsState
  )
    throw new ToolReferenceError('Connections changed. Try again.', 409)
  const latestPermission = await access(env, scope, options)
  if (latestPermission.policyText !== permission.policyText)
    throw new ToolReferenceError('Workspace policy changed. Try again.', 409)
  return { ...permission, sources, ...before, pluginsState }
}
async function configuration(
  env: ToolReferenceEnvironment,
  scope: Scope,
  options: Options,
): Promise<Configuration> {
  try {
    return await readConfiguration(env, scope, options)
  } catch (error) {
    if (error instanceof McpAccountError)
      throw new ToolReferenceError(error.message, error.status)
    throw error
  }
}
async function stillCurrent(
  env: ToolReferenceEnvironment,
  scope: Scope,
  options: Options,
  previous: Configuration,
) {
  const current = await configuration(env, scope, options)
  if (
    current.pluginsState !== previous.pluginsState ||
    current.accountsState !== previous.accountsState ||
    current.ciphertext !== previous.ciphertext ||
    current.kodySubject !== previous.kodySubject ||
    current.policyText !== previous.policyText
  )
    throw new ToolReferenceError(
      'Connections or workspace policy changed. Try again.',
      409,
    )
  return current
}
function readSnapshot(row: Snapshot | undefined, source: Source) {
  if (
    !row ||
    row.fingerprint !== source.fingerprint ||
    new TextEncoder().encode(row.metadata).byteLength > maxSnapshotBytes
  )
    return undefined
  try {
    const items = snapshotSchema.parse(JSON.parse(row.metadata))
    if (
      items.some(
        (item) =>
          !referenceInputSchema.safeParse({
            kind: 'tool',
            serverId: source.connection.id,
            toolName: item.name,
          }).success,
      )
    )
      return undefined
    return items
  } catch {
    return undefined
  }
}
async function snapshots(_env: ToolReferenceEnvironment, scope: Scope) {
  return db.execute<Snapshot & Record<string, unknown>>(
    sql`SELECT server_id,fingerprint,metadata,fetched_at::double precision AS fetched_at FROM chat_mcp_reference_catalog WHERE workspace_id=${scope.workspaceId} AND user_id=${scope.userId}::uuid LIMIT ${maxCachedSources}`,
  )
}

function reference(
  source: Source,
  item: z.infer<typeof itemSchema>,
): MessageReference {
  return {
    kind: 'tool',
    serverId: source.connection.id,
    toolName: item.name,
    label: item.label,
    detail: safeLabel(source.connection.label),
  }
}
export async function listToolReferences(
  env: ToolReferenceEnvironment,
  scope: Scope,
  options: Options & { query: string },
): Promise<ReferenceCatalog> {
  const parsed = z.string().trim().max(200).safeParse(options.query)
  if (!parsed.success)
    throw new ToolReferenceError('Use a search up to 200 characters.')
  const current = await configuration(env, scope, options)
  if (options.fixture) return { items: [], more: false, toolSources: [] }
  const rows = await snapshots(env, scope),
    items: MessageReference[] = [],
    toolSources: NonNullable<ReferenceCatalog['toolSources']> = []
  const query = parsed.data.toLowerCase()
  for (const source of current.sources) {
    const row = rows.find((row) => row.server_id === source.connection.id)
    const metadata = readSnapshot(row, source)
    toolSources.push({
      serverId: source.connection.id,
      label: safeLabel(source.connection.label),
      status: metadata
        ? Date.now() - row!.fetched_at < freshFor
          ? 'ready'
          : 'stale'
        : 'missing',
      ...(metadata ? { fetchedAt: row!.fetched_at } : {}),
    })
    // A credential/endpoint change hides previous-account names, not just their freshness.
    for (const item of metadata ?? [])
      if (
        `${source.connection.label} ${item.name} ${item.label} ${item.description}`
          .toLowerCase()
          .includes(query)
      )
        items.push(reference(source, item))
  }
  await stillCurrent(env, scope, options, current)
  items.sort(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
  )
  return { items: items.slice(0, 50), more: items.length > 50, toolSources }
}
export async function resolveToolReference(
  env: ToolReferenceEnvironment,
  scope: Scope,
  input: { serverId: string; toolName: string },
  options: Options,
): Promise<MessageReference> {
  const parsed = referenceInputSchema.safeParse({ kind: 'tool', ...input })
  if (!parsed.success || parsed.data.kind !== 'tool')
    throw new ToolReferenceError('Choose a saved tool reference.')
  options = { ...options, serverId: input.serverId }
  const current = await configuration(env, scope, options)
  const source = current.sources.find((s) => s.connection.id === input.serverId)
  if (!source)
    throw new ToolReferenceError('Tool connection is unavailable.', 404)
  const row = (await snapshots(env, scope)).find(
    (row) => row.server_id === input.serverId,
  )
  const metadata = readSnapshot(row, source)
  if (!metadata)
    throw new ToolReferenceError(
      'Refresh this connection’s tools before using this reference.',
      409,
    )
  const item = metadata.find((item) => item.name === input.toolName)
  if (!item)
    throw new ToolReferenceError(
      'Tool reference is unavailable. Refresh the connection’s tools.',
      404,
    )
  await stillCurrent(env, scope, options, current)
  // Even a fresh display snapshot does not authorize execution or supply its schema.
  return reference(source, item)
}
function compactCatalog(catalog: ServerCatalog, serverId: string) {
  if (
    catalog.serverId !== serverId ||
    !catalog.complete ||
    !Array.isArray(catalog.entries) ||
    catalog.entries.length > 10_000
  )
    throw new ToolReferenceError(
      'This server returned an incomplete or oversized catalog.',
      502,
    )
  const items: z.infer<typeof itemSchema>[] = [],
    names = new Set<string>()
  for (const entry of catalog.entries) {
    if (entry.kind !== 'tool') continue
    if (
      entry.serverId !== serverId ||
      entry.target?.method !== 'tools/call' ||
      entry.target.name !== entry.name ||
      names.has(entry.name) ||
      !referenceInputSchema.safeParse({
        kind: 'tool',
        serverId,
        toolName: entry.name,
      }).success
    )
      throw new ToolReferenceError(
        'This server returned an invalid tool catalog.',
        502,
      )
    const item = itemSchema.safeParse({
      name: entry.name,
      label: safeLabel(entry.title || entry.name),
      description:
        typeof entry.description === 'string'
          ? entry.description.slice(0, 2000)
          : '',
    })
    if (!item.success || items.length >= maxTools)
      throw new ToolReferenceError(
        'This server returned an invalid or oversized tool catalog.',
        502,
      )
    items.push(item.data)
    names.add(item.data.name)
  }
  const metadata = JSON.stringify(items)
  if (new TextEncoder().encode(metadata).byteLength > maxSnapshotBytes)
    throw new ToolReferenceError(
      'This server’s tool catalog is too large.',
      502,
    )
  return metadata
}
export async function refreshToolReferences(
  env: ToolReferenceEnvironment,
  scope: Scope,
  options: Options,
  serverId: string,
  signal: AbortSignal,
  fetchCatalog = fetchMcpCatalog,
): Promise<ReferenceCatalog> {
  options = { ...options, serverId }
  const startedAt = Date.now()
  const initial = await configuration(env, scope, options)
  const selected = initial.sources.find((s) => s.connection.id === serverId)
  if (!selected)
    throw new ToolReferenceError('Tool connection is unavailable.', 404)
  if (signal.aborted)
    throw new ToolReferenceError('Tool refresh was stopped.', 409)
  let connection: McpConnection | undefined
  try {
    connection = (
      await connectedMcpServers(env, scope.userId, initial.policy, serverId, {
        workspaceId: scope.workspaceId,
      })
    )[0]
  } catch {
    throw new ToolReferenceError(
      'Reconnect this server before refreshing its tools.',
      409,
    )
  }
  // Kody may refresh its own token. Bind this request to the actual new credential.
  const bound = await configuration(env, scope, options)
  const boundSource = bound.sources.find((s) => s.connection.id === serverId)
  if (
    !connection ||
    !boundSource ||
    connection.id !== serverId ||
    connection.url !== boundSource.connection.url ||
    connection.accessToken !== boundSource.connection.accessToken ||
    connection.accountId !== boundSource.connection.accountId ||
    connection.credentialId !== boundSource.connection.credentialId ||
    initial.pluginsState !== bound.pluginsState
  )
    throw new ToolReferenceError(
      'The connection changed. Try refreshing again.',
      409,
    )
  let catalog: ServerCatalog
  try {
    catalog = await fetchCatalog(connection, signal)
  } catch {
    throw new ToolReferenceError(
      signal.aborted
        ? 'Tool refresh was stopped.'
        : 'The server’s tool catalog could not be refreshed.',
      signal.aborted ? 409 : 502,
    )
  }
  if (signal.aborted)
    throw new ToolReferenceError('Tool refresh was stopped.', 409)
  const metadata = compactCatalog(catalog, serverId)
  await stillCurrent(env, scope, options, bound)
  const guard = sql`EXISTS(SELECT 1 FROM chat_memberships a JOIN chat_workspaces w ON w.id=a.workspace_id WHERE a.workspace_id=${scope.workspaceId} AND a.user_id=${scope.userId}::uuid AND w.policy=${bound.policyText}::jsonb AND (${scope.botId ?? null}::text IS NULL OR EXISTS(SELECT 1 FROM chat_bots b WHERE b.id=${scope.botId ?? null} AND b.workspace_id=w.id AND b.deleted_at IS NULL)))
    AND (SELECT ciphertext FROM chat_credentials WHERE user_id=${scope.userId}::uuid) IS NOT DISTINCT FROM ${bound.ciphertext}::text
    AND (SELECT subject FROM chat_kody_links WHERE user_id=${scope.userId}::uuid) IS NOT DISTINCT FROM ${bound.kodySubject}::text
    AND ${accountsStateSql(scope.userId)}=${bound.accountsState} AND ${pluginsStateSql(scope)}=${bound.pluginsState}`
  const ids = bound.sources.map((source) => source.connection.id)
  await db.transaction(
    async (tx) => {
      await tx.execute(
        sql`DELETE FROM chat_mcp_reference_catalog WHERE workspace_id=${scope.workspaceId} AND user_id=${scope.userId}::uuid AND server_id NOT LIKE 'plugin:%' AND ${
          ids.length
            ? sql`server_id NOT IN (${sql.join(
                ids.map((id) => sql`${id}`),
                sql`,`,
              )})`
            : sql`true`
        } AND ${guard}`,
      )
      const result = await tx.execute(
        sql`INSERT INTO chat_mcp_reference_catalog(workspace_id,user_id,server_id,fingerprint,metadata,fetched_at,refresh_started_at) SELECT ${scope.workspaceId},${scope.userId}::uuid,${serverId},${boundSource.fingerprint},${metadata},${Date.now()},${startedAt} WHERE ${guard} ON CONFLICT(workspace_id,user_id,server_id) DO UPDATE SET fingerprint=excluded.fingerprint,metadata=excluded.metadata,fetched_at=excluded.fetched_at,refresh_started_at=excluded.refresh_started_at WHERE excluded.refresh_started_at>=chat_mcp_reference_catalog.refresh_started_at RETURNING server_id`,
      )
      if (!result.length)
        throw new ToolReferenceError(
          'The connection changed or a newer refresh finished. Try again.',
          409,
        )
    },
    { isolationLevel: 'serializable' },
  )
  await db.execute(
    sql`DELETE FROM chat_mcp_reference_catalog WHERE workspace_id=${scope.workspaceId} AND user_id=${scope.userId}::uuid AND server_id IN(SELECT server_id FROM chat_mcp_reference_catalog WHERE workspace_id=${scope.workspaceId} AND user_id=${scope.userId}::uuid ORDER BY fetched_at DESC,server_id OFFSET ${maxCachedSources}) AND ${guard}`,
  )
  return listToolReferences(env, scope, {
    ...options,
    serverId: undefined,
    query: '',
  })
}
