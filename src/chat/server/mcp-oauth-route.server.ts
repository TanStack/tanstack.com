import { jsonError } from '~/utils/api-boundary.server'
import { mcpOAuthRoute } from './mcp-account-api'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import { mcpClientMetadata } from './mcp-setup'
export async function handleMcpOAuth(request: Request) {
  const url = new URL(request.url)
  if (url.pathname === '/auth/mcp/client-metadata')
    return Response.json(
      {
        ...mcpClientMetadata(url.origin),
        client_id: url.origin + '/auth/mcp/client-metadata',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  try {
    return await mcpOAuthRoute(request, await getMcpEnvironment())
  } catch (error) {
    if (error instanceof McpEnvironmentError)
      return jsonError(error.message, error.status)
    throw error
  }
}
