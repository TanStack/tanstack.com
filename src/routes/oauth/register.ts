import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'

/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 *
 * Simplified registration that accepts any client and returns a client_id.
 * Since we use PKCE and public clients, we don't need client secrets.
 */
export const Route = createFileRoute('/oauth/register')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // CORS: Allow any origin for OAuth client registration
        // This is secure because:
        // 1. Registration only generates deterministic client IDs
        // 2. No secrets are issued (PKCE public clients)
        // 3. Redirect URIs are validated for localhost or HTTPS
        const origin = request.headers.get('Origin')
        setResponseHeader('Content-Type', 'application/json')
        setResponseHeader('Access-Control-Allow-Origin', origin || '*')
        setResponseHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        setResponseHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization',
        )

        try {
          const body = await request.json()

          // Extract client metadata from request
          const clientName = body.client_name || 'OAuth Client'
          const redirectUris = body.redirect_uris || []

          // Validate redirect URIs
          for (const uri of redirectUris) {
            try {
              const url = new URL(uri)
              const isLocalhost =
                url.hostname === 'localhost' ||
                url.hostname === '127.0.0.1' ||
                url.hostname === '[::1]'
              const isHttps = url.protocol === 'https:'

              if (!isLocalhost && !isHttps) {
                return new Response(
                  JSON.stringify({
                    error: 'invalid_redirect_uri',
                    error_description:
                      'Redirect URIs must be localhost or HTTPS',
                  }),
                  { status: 400 },
                )
              }
            } catch {
              return new Response(
                JSON.stringify({
                  error: 'invalid_redirect_uri',
                  error_description: 'Invalid redirect URI format',
                }),
                { status: 400 },
              )
            }
          }

          // Generate a client ID based on the client name
          // For public clients with PKCE, we don't need to store these
          // The client_id is deterministic based on client_name for consistency
          const clientId = generateClientId(clientName)

          // Return the client registration response per RFC 7591
          return new Response(
            JSON.stringify({
              client_id: clientId,
              client_name: clientName,
              redirect_uris: redirectUris,
              token_endpoint_auth_method: 'none',
              grant_types: ['authorization_code', 'refresh_token'],
              response_types: ['code'],
            }),
            { status: 201 },
          )
        } catch {
          return new Response(
            JSON.stringify({
              error: 'invalid_client_metadata',
              error_description: 'Could not parse client metadata',
            }),
            { status: 400 },
          )
        }
      },
      OPTIONS: async ({ request }: { request: Request }) => {
        const origin = request.headers.get('Origin')
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        })
      },
    },
  },
})

/**
 * Generate a deterministic client ID from the client name.
 * Since we use PKCE for all clients, we don't need to store client registrations.
 * The client_id just needs to be consistent for the same client_name.
 */
function generateClientId(clientName: string): string {
  // Create a simple hash-based ID from the client name
  // This ensures the same client always gets the same ID
  let hash = 0
  for (let i = 0; i < clientName.length; i++) {
    const char = clientName.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0')
  return `ts-${hashStr}-${clientName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 20)}`
}
