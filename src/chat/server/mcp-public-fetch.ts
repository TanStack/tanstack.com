export interface McpEgressEnvironment {
  MCP_EGRESS_URL?: string
  MCP_EGRESS_TOKEN?: string
  MCP_EGRESS_MODE?: string
}
import { localDevelopment } from './development'
import { McpAuthorizationError } from './mcp-auth-network'

/** The egress mode is trusted deployment configuration, not runtime detection.
 * Vite injects a public-only companion. Other local launchers must supply an
 * equivalent companion, never set the Cloudflare deployment assertion.
 */
export function publicMcpFetch(env: McpEgressEnvironment): typeof fetch {
  const config = env
  if (config.MCP_EGRESS_URL || config.MCP_EGRESS_TOKEN) {
    let proxy: URL
    try {
      proxy = new URL(config.MCP_EGRESS_URL ?? '')
      if (
        proxy.protocol !== 'http:' ||
        proxy.hostname !== '127.0.0.1' ||
        !proxy.port ||
        proxy.pathname !== '/_gum_mcp_egress' ||
        proxy.search ||
        proxy.hash ||
        proxy.username ||
        proxy.password ||
        !/^[A-Za-z0-9_-]{43}$/.test(config.MCP_EGRESS_TOKEN ?? '')
      )
        throw Error()
    } catch {
      throw new McpAuthorizationError(
        'The local connection service is not configured correctly. Restart the development server.',
        503,
      )
    }
    const token = config.MCP_EGRESS_TOKEN ?? ''
    return async (input, init) => {
      const request = new Request(input, init)
      const destination = new URL(request.url)
      if (
        destination.protocol !== 'https:' ||
        destination.username ||
        destination.password ||
        destination.hash
      )
        throw new McpAuthorizationError(
          'Connections require an HTTPS service address.',
        )
      const headers = new Headers(request.headers)
      headers.set('x-gum-egress-target', destination.href)
      headers.set('x-gum-egress-auth', token)
      return fetch(proxy.href, {
        method: request.method,
        headers,
        ...(!['GET', 'HEAD'].includes(request.method)
          ? { body: request.body, duplex: 'half' }
          : {}),
        redirect: 'manual',
        signal: request.signal,
      })
    }
  }
  if (config.MCP_EGRESS_MODE === 'cloudflare-public' && !localDevelopment())
    return fetch
  throw new McpAuthorizationError(
    'Remote connections are not enabled in this environment. Start the development server with its connection service.',
    503,
  )
}
