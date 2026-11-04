import { hash } from './crypto'
import {
  ServerCapabilitiesSchema,
  type ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface McpConnection {
  accountId?: string
  credentialId?: string
  fetch?: typeof fetch
  plugin?: { installationId: string; version: number }
  id: string
  label: string
  url: string
  accessToken?: string
  discoveryIntegration?: string
  trustedForDiscovery?: boolean
}
const sessionSchema = z.object({
  connectionHash: z.string(),
  sessionId: z.string().min(1),
  protocolVersion: z.string().min(1),
  capabilities: ServerCapabilitiesSchema,
})
export type McpSessionState = z.infer<typeof sessionSchema>
export interface McpClientOptions {
  /** The host scopes this store to one account, conversation/task, and server. */
  session?: {
    load(): Promise<unknown>
    save(state: McpSessionState | undefined): Promise<void>
  }
  /** Dependency injection for transports and protocol tests, never server supplied. */
  fetch?: typeof fetch
}
export async function withMcpClient<T>(
  connection: McpConnection,
  work: (
    client: Client,
    capabilities: ServerCapabilities | undefined,
  ) => Promise<T>,
  signal?: AbortSignal,
  options: McpClientOptions = {},
) {
  const client = new Client(
    { name: 'gum', version: '0.1.0' },
    { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  )
  // Session credentials must never follow an endpoint or authentication change.
  const connectionHash = options.session
    ? await hash(
        JSON.stringify([
          connection.id,
          connection.url,
          connection.credentialId ?? connection.accessToken ?? null,
        ]),
      )
    : undefined
  const rawSession = await options.session?.load()
  const parsed =
    rawSession === undefined ? undefined : sessionSchema.safeParse(rawSession)
  if (parsed && !parsed.success)
    throw new Error('Saved MCP session metadata is invalid.')
  const saved =
    parsed?.success && parsed.data.connectionHash === connectionHash
      ? parsed.data
      : undefined
  const transport = new StreamableHTTPClientTransport(new URL(connection.url), {
    sessionId: saved?.sessionId,
    fetch: options.fetch ?? connection.fetch,
    requestInit: {
      redirect: 'manual',
      ...(connection.accessToken
        ? { headers: { Authorization: 'Bearer ' + connection.accessToken } }
        : {}),
    },
  })
  if (saved) transport.setProtocolVersion(saved.protocolVersion)
  try {
    await client.connect(transport, { signal, timeout: 30000 })
    const capabilities = client.getServerCapabilities() ?? saved?.capabilities
    if (options.session && !saved) {
      // Persist before executing user work. A failed save must not leave an unresumable mutation.
      await options.session.save(
        transport.sessionId && transport.protocolVersion && capabilities
          ? {
              connectionHash: connectionHash!,
              sessionId: transport.sessionId,
              protocolVersion: transport.protocolVersion,
              capabilities,
            }
          : undefined,
      )
    }
    return await work(client, capabilities)
  } finally {
    await client.close()
  }
}
export function mcpCall(
  connection: McpConnection,
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
  options: McpClientOptions = {},
) {
  return withMcpClient(
    connection,
    (client) =>
      client.callTool({ name, arguments: args }, undefined, {
        signal,
        timeout: 100000,
      }),
    signal,
    options,
  )
}

export async function mcpRead(
  connection: McpConnection,
  entry: import('./mcp-catalog').CatalogEntry,
  args: Record<string, unknown>,
  signal: AbortSignal,
  connectionOptions: McpClientOptions = {},
) {
  return withMcpClient(
    connection,
    async (client) => {
      const options = { signal, timeout: 30000 }
      if (entry.kind === 'tool')
        return client.callTool(
          { name: entry.name, arguments: args },
          undefined,
          options,
        )
      if (entry.kind === 'prompt')
        return client.getPrompt(
          { name: entry.name, arguments: args as Record<string, string> },
          options,
        )
      if (entry.kind === 'resource' && entry.target.uri)
        return client.readResource({ uri: entry.target.uri }, options)
      throw new Error('Unsupported discovery operation.')
    },
    signal,
    connectionOptions,
  )
}
