import { createFileRoute } from '@tanstack/react-router'
import { env } from '~/utils/env'
import {
  generateOAuthState,
  createOAuthStateCookie,
  buildGitHubAuthUrl,
  buildGoogleAuthUrl,
} from '~/auth/index.server'

export const Route = createFileRoute('/auth/$provider/start')({
  // @ts-ignore server property not in route types yet
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { provider: string }
      }) => {
        const provider = params.provider as 'github' | 'google'

        if (provider !== 'github' && provider !== 'google') {
          return Response.redirect(new URL('/login', request.url), 302)
        }

        // Generate random state token for CSRF protection
        const state = generateOAuthState()

        // Store state in HTTPS-only cookie for CSRF protection
        const isProduction = process.env.NODE_ENV === 'production'
        const stateCookie = createOAuthStateCookie(state, isProduction)

        // Build OAuth URL based on provider
        const origin = env.SITE_URL || new URL(request.url).origin
        const redirectUri = `${origin}/api/auth/callback/${provider}`

        let authUrl: string

        if (provider === 'github') {
          const clientId = env.GITHUB_OAUTH_CLIENT_ID
          if (!clientId) {
            throw new Error('GITHUB_OAUTH_CLIENT_ID is not configured')
          }
          authUrl = buildGitHubAuthUrl(clientId, redirectUri, state)
        } else {
          // Google
          const clientId = env.GOOGLE_OAUTH_CLIENT_ID
          if (!clientId) {
            throw new Error('GOOGLE_OAUTH_CLIENT_ID is not configured')
          }
          authUrl = buildGoogleAuthUrl(clientId, redirectUri, state)
        }

        // Return redirect with state cookie set
        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            'Set-Cookie': stateCookie,
          },
        })
      },
    },
  },
})
