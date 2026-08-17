import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  isRecord,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'
import {
  createRegisteredClientId,
  validateRedirectUri,
} from '~/auth/oauthClient.server'

const MAX_OAUTH_REGISTRATION_BYTES = 16 * 1024
const MAX_OAUTH_REDIRECT_URIS = 10
const MAX_OAUTH_REDIRECT_URI_TOTAL_LENGTH = 4096

function oauthRegistrationError(
  error: string,
  errorDescription: string,
  status: number,
) {
  return jsonResponse(
    {
      error,
      error_description: errorDescription,
    },
    { status },
  )
}

function readClientName(body: Record<string, unknown>) {
  const clientName = body.client_name
  if (typeof clientName !== 'string') {
    return 'OAuth Client'
  }

  return clientName.trim().slice(0, 100) || 'OAuth Client'
}

function readRedirectUris(body: Record<string, unknown>) {
  const redirectUris = body.redirect_uris
  if (!Array.isArray(redirectUris)) {
    return []
  }

  return redirectUris
    .filter((uri) => typeof uri === 'string' && uri.length <= 2_048)
    .map((uri) => uri.trim())
}

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
          const guardError = validateJsonRequest(request, {
            maxContentLength: MAX_OAUTH_REGISTRATION_BYTES,
            requireSameOrigin: false,
          })
          if (guardError) {
            return oauthRegistrationError(
              'invalid_client_metadata',
              guardError.message,
              guardError.status,
            )
          }

          const bodyResult = await readJsonBody(request, {
            maxContentLength: MAX_OAUTH_REGISTRATION_BYTES,
          })
          if (!bodyResult.success || !isRecord(bodyResult.body)) {
            return oauthRegistrationError(
              'invalid_client_metadata',
              'Could not parse client metadata',
              400,
            )
          }

          // Extract client metadata from request
          const clientName = readClientName(bodyResult.body)
          const redirectUris = readRedirectUris(bodyResult.body)

          if (
            redirectUris.length === 0 ||
            redirectUris.length > MAX_OAUTH_REDIRECT_URIS ||
            redirectUris.join('').length > MAX_OAUTH_REDIRECT_URI_TOTAL_LENGTH
          ) {
            return oauthRegistrationError(
              'invalid_redirect_uri',
              `Provide 1-${MAX_OAUTH_REDIRECT_URIS} redirect URIs`,
              400,
            )
          }

          // Validate redirect URIs
          for (const uri of redirectUris) {
            if (!validateRedirectUri(uri)) {
              return oauthRegistrationError(
                'invalid_redirect_uri',
                'Redirect URIs must be localhost HTTP(S) or HTTPS',
                400,
              )
            }
          }

          const clientId = await createRegisteredClientId({
            clientName,
            redirectUris,
          })

          // Return the client registration response per RFC 7591
          return jsonResponse(
            {
              client_id: clientId,
              client_name: clientName,
              redirect_uris: redirectUris,
              token_endpoint_auth_method: 'none',
              grant_types: ['authorization_code', 'refresh_token'],
              response_types: ['code'],
            },
            { status: 201 },
          )
        } catch {
          return oauthRegistrationError(
            'invalid_client_metadata',
            'Could not parse client metadata',
            400,
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
