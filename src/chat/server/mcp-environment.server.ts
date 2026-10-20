import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import type { CredentialEnv } from './credentials'
import type { McpEgressEnvironment } from './mcp-public-fetch'
export class McpEnvironmentError extends Error {
  readonly status = 503
}
export async function getMcpEnvironment(): Promise<
  CredentialEnv & McpEgressEnvironment
> {
  const env = await getHostRuntimeEnv()
  const read = (name: string) => {
    const value = env?.[name] ?? process.env[name]
    return typeof value === 'string' ? value : undefined
  }
  const key = read('ENCRYPTION_KEY')
  if (!key || key.length < 32)
    throw new McpEnvironmentError(
      'Connected account storage is not configured.',
    )
  return {
    ENCRYPTION_KEY: key,
    MCP_EGRESS_URL: read('MCP_EGRESS_URL'),
    MCP_EGRESS_TOKEN: read('MCP_EGRESS_TOKEN'),
    MCP_EGRESS_MODE: read('MCP_EGRESS_MODE'),
  }
}
