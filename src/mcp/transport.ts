import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from './server'
import {
  validateApiKey,
  checkRateLimit,
  cleanupRateLimits,
} from './auth.server'

// Check if auth is enabled (defaults based on NODE_ENV)
function isAuthEnabled(): boolean {
  const env = process.env.MCP_AUTH_ENABLED
  if (env === 'true' || env === '1') return true
  if (env === 'false' || env === '0') return false
  // Default: disabled in dev, enabled in prod
  return process.env.NODE_ENV === 'production'
}

/**
 * Create a JSON-RPC error response
 */
function jsonRpcError(
  code: number,
  message: string,
  httpStatus: number,
  headers?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    }),
    {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    },
  )
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const authEnabled = isAuthEnabled()

  let rateLimitIdentifier: string | undefined
  let rateLimitPerMinute: number | undefined

  if (authEnabled) {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader) {
      return jsonRpcError(
        -32001,
        'Authentication required. Get an API key at https://tanstack.com/account/api-keys',
        401,
      )
    }

    // Validate API key
    const authResult = await validateApiKey(authHeader)

    if (!authResult.success) {
      return jsonRpcError(-32001, authResult.error, authResult.status)
    }

    rateLimitIdentifier = authResult.keyId
    rateLimitPerMinute = authResult.rateLimitPerMinute

    // Check rate limit
    const rateLimit = await checkRateLimit(
      rateLimitIdentifier,
      'api_key',
      rateLimitPerMinute,
    )

    if (!rateLimit.allowed) {
      return jsonRpcError(-32002, 'Rate limit exceeded', 429, {
        'X-RateLimit-Limit': rateLimitPerMinute.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.floor(
          rateLimit.resetAt.getTime() / 1000,
        ).toString(),
        'Retry-After': Math.ceil(
          (rateLimit.resetAt.getTime() - Date.now()) / 1000,
        ).toString(),
      })
    }

    // Periodically cleanup old rate limit records (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupRateLimits().catch(() => {})
    }
  }

  // Create a new server and transport for each request (stateless serverless mode)
  const server = createMcpServer()

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode - no sessions
    enableJsonResponse: true, // Use JSON responses for simpler serverless handling
  })

  // Connect the server to the transport
  await server.connect(transport)

  try {
    // Handle the request
    const response = await transport.handleRequest(request)

    // Add rate limit headers to successful responses if auth is enabled
    if (authEnabled && rateLimitPerMinute) {
      const headers = new Headers(response.headers)
      headers.set('X-RateLimit-Limit', rateLimitPerMinute.toString())
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    return response
  } catch (error) {
    // Return error response for unhandled errors
    return jsonRpcError(
      -32603,
      error instanceof Error ? error.message : 'Internal error',
      500,
    )
  }
}
