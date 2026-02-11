import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from '~/auth/oauthClient.server'

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
          const body = await request.text()
          params = new URLSearchParams(body)
        } else if (contentType.includes('application/json')) {
          const body = await request.json()
          params = new URLSearchParams(body)
        } else {
          return new Response(
            JSON.stringify({
              error: 'invalid_request',
              error_description:
                'Content-Type must be application/x-www-form-urlencoded or application/json',
            }),
            { status: 400 },
          )
        }

        const grantType = params.get('grant_type')

        if (grantType === 'authorization_code') {
          const code = params.get('code')
          const codeVerifier = params.get('code_verifier')
          const redirectUri = params.get('redirect_uri')

          if (!code || !codeVerifier || !redirectUri) {
            return new Response(
              JSON.stringify({
                error: 'invalid_request',
                error_description:
                  'Missing required parameters: code, code_verifier, redirect_uri',
              }),
              { status: 400 },
            )
          }

          const result = await exchangeAuthorizationCode({
            code,
            codeVerifier,
            redirectUri,
          })

          if (!result.success) {
            return new Response(
              JSON.stringify({
                error: result.error,
                error_description:
                  'The authorization code is invalid or has expired',
              }),
              { status: 400 },
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
            return new Response(
              JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing required parameter: refresh_token',
              }),
              { status: 400 },
            )
          }

          const result = await refreshAccessToken(refreshToken)

          if (!result.success) {
            return new Response(
              JSON.stringify({
                error: result.error,
                error_description:
                  'The refresh token is invalid or has expired',
              }),
              { status: 400 },
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

        return new Response(
          JSON.stringify({
            error: 'unsupported_grant_type',
            error_description:
              'Only authorization_code and refresh_token grant types are supported',
          }),
          { status: 400 },
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
