import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from '~/auth/oauthClient.server'
import {
  isRecord,
  readJsonBody,
  readTextBody,
} from '~/utils/api-boundary.server'

const MAX_OAUTH_TOKEN_BODY_BYTES = 16 * 1024

function oauthTokenError(
  error: string,
  errorDescription: string,
  status: number,
) {
  return new Response(
    JSON.stringify({
      error,
      error_description: errorDescription,
    }),
    { status },
  )
}

async function readLimitedFormBody(request: Request) {
  const result = await readTextBody(request, MAX_OAUTH_TOKEN_BODY_BYTES)
  if (!result.success) {
    return {
      error: oauthTokenError(
        'invalid_request',
        result.error.message,
        result.error.status,
      ),
    }
  }

  return { params: new URLSearchParams(result.text) }
}

async function readLimitedJsonBody(request: Request) {
  const result = await readJsonBody(request, {
    maxContentLength: MAX_OAUTH_TOKEN_BODY_BYTES,
  })
  if (!result.success || !isRecord(result.body)) {
    return {
      error: oauthTokenError(
        'invalid_request',
        'Could not parse token request body',
        400,
      ),
    }
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(result.body)) {
    if (typeof value === 'string') {
      params.set(key, value)
    }
  }

  return { params }
}

export const Route = createFileRoute('/oauth/token')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // CORS: Allow any origin for OAuth token endpoint
        // This is secure because:
        // 1. PKCE (code_verifier) is required - attacker cannot forge this
        // 2. Authorization code is one-time use and short-lived
        // 3. No cookies are used - tokens are returned in response body
        const origin = request.headers.get('Origin')
        setResponseHeader('Access-Control-Allow-Origin', origin || '*')
        setResponseHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        setResponseHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization',
        )
        setResponseHeader('Content-Type', 'application/json')
        setResponseHeader('Cache-Control', 'no-store')
        setResponseHeader('Pragma', 'no-cache')

        // Parse request body (application/x-www-form-urlencoded)
        const contentType = request.headers.get('Content-Type') || ''
        let params: URLSearchParams

        if (contentType.includes('application/x-www-form-urlencoded')) {
          const result = await readLimitedFormBody(request)
          if ('error' in result) return result.error
          params = result.params
        } else if (contentType.includes('application/json')) {
          const result = await readLimitedJsonBody(request)
          if ('error' in result) return result.error
          params = result.params
        } else {
          return oauthTokenError(
            'invalid_request',
            'Content-Type must be application/x-www-form-urlencoded or application/json',
            400,
          )
        }

        const grantType = params.get('grant_type')

        if (grantType === 'authorization_code') {
          const code = params.get('code')
          const codeVerifier = params.get('code_verifier')
          const redirectUri = params.get('redirect_uri')

          if (!code || !codeVerifier || !redirectUri) {
            return oauthTokenError(
              'invalid_request',
              'Missing required parameters: code, code_verifier, redirect_uri',
              400,
            )
          }

          const result = await exchangeAuthorizationCode({
            code,
            codeVerifier,
            redirectUri,
          })

          if (!result.success) {
            return oauthTokenError(
              result.error,
              'The authorization code is invalid or has expired',
              400,
            )
          }

          return new Response(
            JSON.stringify({
              access_token: result.accessToken,
              token_type: 'Bearer',
              expires_in: result.expiresIn,
              refresh_token: result.refreshToken,
              scope: result.scope,
            }),
            { status: 200 },
          )
        }

        if (grantType === 'refresh_token') {
          const refreshToken = params.get('refresh_token')

          if (!refreshToken) {
            return oauthTokenError(
              'invalid_request',
              'Missing required parameter: refresh_token',
              400,
            )
          }

          const result = await refreshAccessToken(refreshToken)

          if (!result.success) {
            return oauthTokenError(
              result.error,
              'The refresh token is invalid or has expired',
              400,
            )
          }

          return new Response(
            JSON.stringify({
              access_token: result.accessToken,
              token_type: 'Bearer',
              expires_in: result.expiresIn,
              scope: result.scope,
            }),
            { status: 200 },
          )
        }

        return oauthTokenError(
          'unsupported_grant_type',
          'Only authorization_code and refresh_token grant types are supported',
          400,
        )
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
