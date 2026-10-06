import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { CredentialEnv } from './credentials'
import { z } from 'zod'
import type { SavedMcpServer } from '../core/types'
import type { McpConnection } from './mcp'
import { hash } from './crypto'
import { validateMcpEndpoint } from './public-endpoint'

const selection = z
  .object({
    installationId: z.string().uuid(),
    version: z.number().int().positive().safe(),
  })
  .strict()
const identityPattern =
  /^plugin:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([1-9][0-9]*):([A-Za-z0-9_-]{43})$/i
/** Parsing an ID supplies a lookup key only, never evidence of access. */
export function pluginConnectionIdentity(
  serverId: string,
): { installationId: string; version: number } | undefined {
  const match = identityPattern.exec(serverId)
  if (!match) return
  const parsed = selection.safeParse({
    installationId: match[1],
    version: Number(match[2]),
  })
  return parsed.success ? parsed.data : undefined
}
const metadataSchema = z.object({
  name: z.string(),
  status: z.literal('supported'),
  servers: z.array(
    z.object({
      key: z.string(),
      type: z.string(),
      url: z.string().optional(),
      supported: z.boolean(),
    }),
  ),
})
const bindingsSchema = z.array(
  z.object({
    key: z.string(),
    serverId: z.string().uuid(),
    endpoint: z.string(),
  }),
)
type Row = {
  id: string
  version: number
  revision: number
  digest: string
  metadata: string
  bindings: string
}
/** Local metadata resolution only. Callers supply current credentials and enforce MCP policy. */
export async function pluginMcpConnections(
  _env: CredentialEnv,
  scope: { workspaceId: string; userId: string },
  servers: SavedMcpServer[],
  options: {
    serverId?: string
    versions?: Array<{ installationId: string; version: number }>
  } = {},
): Promise<McpConnection[]> {
  const parsed = z
    .array(selection)
    .max(50)
    .safeParse(options.versions ?? [])
  if (!parsed.success) return []
  const pins = new Map<string, number>()
  for (const p of parsed.data) {
    if (pins.has(p.installationId) && pins.get(p.installationId) !== p.version)
      return []
    pins.set(p.installationId, p.version)
  }
  const exact =
    options.serverId === undefined
      ? undefined
      : pluginConnectionIdentity(options.serverId)
  if (options.serverId !== undefined && !exact) return []
  if (exact) {
    if (
      pins.has(exact.installationId) &&
      pins.get(exact.installationId) !== exact.version
    )
      return []
    pins.set(exact.installationId, exact.version)
  }
  const query = () =>
    db.execute<Row & Record<string, unknown>>(sql`
    SELECT p.id,v.version::double precision AS version,p.revision::double precision AS revision,v.digest,
    jsonb_build_object('name',v.preview->'manifest'->>'name','status',v.preview->'compatibility'->>'status','servers',v.preview->'mcpServers')::text AS metadata,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('key',b.requirement_key,'serverId',b.server_id,'endpoint',b.endpoint) ORDER BY b.requirement_key) FROM chat_plugin_bindings b WHERE b.installation_id=p.id AND b.version=v.version),'[]'::jsonb)::text AS bindings
    FROM chat_plugin_installations p JOIN chat_memberships m ON m.workspace_id=p.workspace_id AND m.user_id=p.user_id
    LEFT JOIN jsonb_array_elements(${JSON.stringify([...pins].map(([installationId, version]) => ({ installationId, version })))}::jsonb) chosen ON chosen->>'installationId'=p.id::text
    JOIN chat_plugin_versions v ON v.installation_id=p.id AND v.version=COALESCE((chosen->>'version')::bigint,p.current_version)
    WHERE p.workspace_id=${scope.workspaceId} AND p.user_id=${scope.userId} AND p.enabled=true AND p.removed=false ${exact ? sql`AND p.id=${exact.installationId}` : sql``} ORDER BY p.id LIMIT 50`)
  const rows = await query(),
    candidates: Array<{ row: Row; connection: McpConnection }> = []
  for (const row of rows) {
    let metadata: z.infer<typeof metadataSchema>,
      bindings: z.infer<typeof bindingsSchema>
    try {
      metadata = metadataSchema.parse(JSON.parse(row.metadata))
      bindings = bindingsSchema.parse(JSON.parse(row.bindings))
    } catch {
      continue
    }
    for (const requirement of metadata.servers) {
      if (
        !requirement.supported ||
        requirement.type !== 'streamable-http' ||
        !requirement.url
      )
        continue
      const binding = bindings.find((b) => b.key === requirement.key),
        server =
          binding && servers.find((s) => s.id === binding.serverId && s.enabled)
      if (!binding || !server) continue
      let endpoint: string
      try {
        endpoint = validateMcpEndpoint(requirement.url)
        if (
          validateMcpEndpoint(binding.endpoint) !== endpoint ||
          validateMcpEndpoint(server.url) !== endpoint
        )
          continue
      } catch {
        continue
      }
      const id = `plugin:${row.id}:${row.version}:${await hash(requirement.key)}`
      if (options.serverId !== undefined && options.serverId !== id) continue
      candidates.push({
        row,
        connection: {
          id,
          label: `${metadata.name} / ${requirement.key}`,
          url: endpoint,
          accessToken: server.accessToken,
          accountId: server.id,
          ...(server.credentialId ? { credentialId: server.credentialId } : {}),
          trustedForDiscovery: false,
          plugin: { installationId: row.id, version: row.version },
        },
      })
    }
  }
  // Hashing yields. Recheck membership, lifecycle, version choice and bindings
  // before returning any credentials. A changed package never falls back.
  const current = await query()
  return candidates
    .filter(({ row }) =>
      current.some(
        (now) =>
          now.id === row.id &&
          now.version === row.version &&
          now.revision === row.revision &&
          now.digest === row.digest &&
          now.metadata === row.metadata &&
          now.bindings === row.bindings,
      ),
    )
    .map((c) => c.connection)
}
