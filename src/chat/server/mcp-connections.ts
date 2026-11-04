import type { KodyEnvironment } from './kody'
import type { McpEgressEnvironment } from './mcp-public-fetch'
import { readWorkspacePolicy } from '../workspace-policy.server'
import { validateMcpEndpoint } from './public-endpoint'
import { readCredentials } from './credentials'
import { type Policy } from '../core/types'
import type { McpConnection } from './mcp'
import { kodyConnection } from './kody'
import { pluginMcpConnections } from './plugin-connections'
import type { TaskPlugin } from './task-plugins'
import { runtimeMcpAccounts } from './mcp-account-runtime'
import { publicMcpFetch } from './mcp-public-fetch'
import { McpAccounts } from './mcp-accounts'

// The existing OAuth account is the first registered connection.
// Catalog and selection code receive only standard MCP connections.
export async function connectedMcpServers(
  env: KodyEnvironment & McpEgressEnvironment,
  userId: string,
  policy: Policy,
  serverId?: string,
  scope?: { workspaceId: string; versions?: TaskPlugin[] },
): Promise<McpConnection[]> {
  if (scope) {
    let current: Policy
    try {
      current = await readWorkspacePolicy(scope.workspaceId, userId)
    } catch {
      return []
    }
    policy = {
      ...policy,
      allowMcp: policy.allowMcp && current.allowMcp,
      allowKody: policy.allowKody && current.allowKody,
    }
  }
  const accountScope = {
    workspaceId: scope?.workspaceId ?? `personal:${userId}`,
    userId,
  }
  const [credentialRead, accountRead] = await Promise.allSettled([
    policy.allowKody && (!serverId || serverId === 'kody')
      ? readCredentials(env, userId)
      : null,
    policy.allowMcp && serverId !== 'kody'
      ? new McpAccounts(env, accountScope).configuredServers()
      : [],
  ])
  if (credentialRead.status === 'rejected') throw credentialRead.reason
  if (accountRead.status === 'rejected') throw accountRead.reason
  const credentials = credentialRead.value
  let accounts = accountRead.value
  let accountId = serverId?.startsWith('mcp:') ? serverId.slice(4) : undefined
  if (serverId?.startsWith('plugin:') && scope) {
    const alias = (
      await pluginMcpConnections(env, accountScope, accounts, {
        serverId,
        versions: scope.versions,
      })
    )[0]
    accountId = alias?.accountId
    if (!accountId) accounts = []
  }
  // Listing configured capabilities never rotates credentials. Resolve only the
  // selected account immediately before its actual tool or access-check work.
  if (policy.allowMcp && accountId)
    accounts = await runtimeMcpAccounts(env, accountScope, { id: accountId })
  const servers: McpConnection[] = policy.allowMcp
    ? accounts
        .filter(
          (server) =>
            server.enabled && (!serverId || serverId === 'mcp:' + server.id),
        )
        .map((server) => ({
          id: 'mcp:' + server.id,
          accountId: server.id,
          label: server.label,
          url: validateMcpEndpoint(server.url),
          accessToken: server.accessToken,
          credentialId: server.credentialId,
          fetch: (input, init) => publicMcpFetch(env)(input, init),
          trustedForDiscovery: false,
        }))
    : []
  if (
    (!serverId || serverId === 'kody') &&
    policy.allowKody &&
    credentials?.kody
  )
    servers.unshift({
      ...(serverId === 'kody'
        ? await kodyConnection(env, userId)
        : {
            id: 'kody',
            label: 'Kody',
            url: `${env.KODY_ORIGIN}/mcp`,
            accessToken: credentials.kody.access_token,
          }),
      trustedForDiscovery: true,
      discoveryIntegration: 'kody',
    })
  if (scope && policy.allowMcp)
    servers.push(
      ...(await pluginMcpConnections(
        env,
        { workspaceId: scope.workspaceId, userId },
        accounts,
        { serverId, versions: scope.versions },
      )),
    )
  for (const server of servers)
    if (server.plugin)
      server.fetch = (input, init) => publicMcpFetch(env)(input, init)
  return servers
}
