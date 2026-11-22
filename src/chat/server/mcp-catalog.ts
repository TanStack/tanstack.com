import { z } from 'zod'
import { hash } from './crypto'
import { withMcpClient, type McpConnection, type McpClientOptions } from './mcp'

export interface CatalogEntry {
  id: string
  serverId: string
  serverLabel: string
  kind: 'tool' | 'prompt' | 'resource' | 'resource-template' | 'capability'
  name: string
  title: string
  description: string
  target: {
    method: 'tools/call' | 'prompts/get' | 'resources/read'
    name?: string
    uri?: string
    uriTemplate?: string
  }
  discovered?: {
    integration?: {
      id: string
      version: number
      identity: string
      kind: 'group' | 'capability' | 'documentation'
    }
    sourceId: string
    sourceArguments: Record<string, unknown>
    evidence: string
    invocation: string
    verified: false
  }
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  arguments?: unknown[]
  annotations?: Record<string, unknown>
}
export interface ServerCatalog {
  serverId: string
  entries: CatalogEntry[]
  learned?: CatalogEntry[]
  inventory?: import('./discovery-integrations/contract').InventoryResult
  fetchedAt: number
  complete: boolean
  scope: 'server-advertised'
  warnings: string[]
}
type CatalogKind = 'tools' | 'prompts' | 'resources' | 'resourceTemplates'
export interface CatalogSource {
  id: string
  label: string
  kinds: CatalogKind[]
  list(kind: CatalogKind, cursor?: string): Promise<unknown>
}
const rowSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().default(''),
  uri: z.string().optional(),
  uriTemplate: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  arguments: z.array(z.unknown()).optional(),
  annotations: z.record(z.string(), z.unknown()).optional(),
})
/** Enumerates metadata only. Never calls a tool, gets a prompt, or reads a resource. */
export async function collectMcpCatalog(
  source: CatalogSource,
  signal: AbortSignal,
): Promise<ServerCatalog> {
  const entries = new Map<string, CatalogEntry>()
  const warnings: string[] = []
  for (const collection of source.kinds) {
    let cursor: string | undefined
    const cursors = new Set<string>()
    for (let page = 0; page < 100; page++) {
      if (signal.aborted) throw new Error('Stopped')
      const response = z
        .object({ nextCursor: z.string().optional() })
        .passthrough()
        .parse(await source.list(collection, cursor))
      const rows = z.array(rowSchema).parse(response[collection])
      for (const row of rows) {
        const kind =
          collection === 'tools'
            ? 'tool'
            : collection === 'prompts'
              ? 'prompt'
              : collection === 'resources'
                ? 'resource'
                : 'resource-template'
        const identity =
          kind === 'resource'
            ? row.uri
            : kind === 'resource-template'
              ? row.uriTemplate
              : row.name
        if (
          !identity ||
          (kind === 'tool' && row.inputSchema?.type !== 'object')
        )
          throw new Error('The MCP server returned an invalid catalog entry.')
        const id = JSON.stringify([source.id, kind, identity])
        entries.set(id, {
          id,
          serverId: source.id,
          serverLabel: source.label,
          kind,
          name: row.name ?? identity,
          title: row.title ?? row.name ?? identity,
          description: row.description,
          target:
            kind === 'tool'
              ? { method: 'tools/call', name: row.name }
              : kind === 'prompt'
                ? { method: 'prompts/get', name: row.name }
                : kind === 'resource'
                  ? { method: 'resources/read', uri: row.uri }
                  : { method: 'resources/read', uriTemplate: row.uriTemplate },
          inputSchema: row.inputSchema,
          outputSchema: row.outputSchema,
          arguments: row.arguments,
          annotations: row.annotations,
        })
      }
      cursor = response.nextCursor
      if (!cursor) break
      if (cursors.has(cursor))
        throw new Error('The MCP server repeated a catalog cursor.')
      cursors.add(cursor)
      if (page === 99)
        warnings.push(collection + ' exceeded the catalog page limit.')
    }
  }
  return {
    serverId: source.id,
    entries: [...entries.values()],
    fetchedAt: Date.now(),
    complete: !warnings.length,
    scope: 'server-advertised',
    warnings,
  }
}
export async function fetchMcpCatalog(
  connection: McpConnection,
  signal: AbortSignal,
  clientOptions: McpClientOptions = {},
) {
  return withMcpClient(
    connection,
    (client, capabilities) => {
      const kinds: CatalogKind[] = [
        ...(capabilities?.tools ? ['tools' as const] : []),
        ...(capabilities?.prompts ? ['prompts' as const] : []),
        ...(capabilities?.resources
          ? ['resources' as const, 'resourceTemplates' as const]
          : []),
      ]
      const options = { signal, timeout: 30000 }
      return collectMcpCatalog(
        {
          id: connection.id,
          label: connection.label,
          kinds,
          list: (kind, cursor) =>
            kind === 'tools'
              ? client.listTools({ cursor }, options)
              : kind === 'prompts'
                ? client.listPrompts({ cursor }, options)
                : kind === 'resources'
                  ? client.listResources({ cursor }, options)
                  : client.listResourceTemplates({ cursor }, options),
        },
        signal,
      )
    },
    signal,
    clientOptions,
  )
}
export interface CatalogStore {
  get(key: string): Promise<ServerCatalog | undefined>
  put(key: string, value: ServerCatalog): Promise<void>
}
export async function cachedMcpCatalog(
  connection: McpConnection,
  scope: { userId: string; workspaceId: string; taskId?: string },
  store: CatalogStore,
  signal: AbortSignal,
  refresh = false,
  fetchCatalog = fetchMcpCatalog,
) {
  // Token changes invalidate the snapshot without storing credentials in the cache.
  if (signal.aborted) throw new Error('Stopped')
  const key = await hash(
    JSON.stringify([
      'mcp-catalog-v2',
      scope.taskId ?? null,
      scope.userId,
      scope.workspaceId,
      connection.id,
      connection.url,
      connection.accessToken ?? '',
    ]),
  )
  const saved = refresh ? undefined : await store.get(key)
  if (saved && saved.complete && Date.now() - saved.fetchedAt < 300000)
    return { ...saved, key, cache: 'hit' as const }
  const catalog = await fetchCatalog(connection, signal)
  if (signal.aborted) throw new Error('Stopped')
  await store.put(key, catalog)
  return { ...catalog, key, cache: 'refreshed' as const }
}

/** Replace only authoritative native entries for this server, preserving other server scopes. */
export function replaceServerCatalog(
  entries: CatalogEntry[],
  snapshot: ServerCatalog,
) {
  if (!snapshot.complete) throw new Error('Updated MCP catalog is incomplete.')
  if (snapshot.entries.some((entry) => entry.serverId !== snapshot.serverId))
    throw new Error('Updated MCP catalog changed server scope.')
  const nativeIds = new Set(snapshot.entries.map((entry) => entry.id))
  if (nativeIds.size !== snapshot.entries.length)
    throw new Error('Updated MCP catalog has duplicate identities.')
  return [
    ...entries.filter(
      (entry) =>
        entry.serverId !== snapshot.serverId ||
        (entry.discovered && nativeIds.has(entry.discovered.sourceId)),
    ),
    ...snapshot.entries,
  ]
}
