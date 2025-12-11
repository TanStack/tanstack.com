import { createFileRoute } from '@tanstack/react-router'
import { env } from '~/utils/env'

export const Route = createFileRoute('/auth/$provider/start')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const provider = params.provider as 'github' | 'google'

        if (provider !== 'github' && provider !== 'google') {
          return Response.redirect(new URL('/login', request.url), 302)
        }

        // Generate random state token (16 bytes = 128 bits)
        const stateBytes = new Uint8Array(16)
        crypto.getRandomValues(stateBytes)
        // Convert to base64url without using Buffer (browser-compatible)
        const base64 = btoa(String.fromCharCode(...stateBytes))
        const state = base64
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '')

        // Store state in HTTPS-only cookie for CSRF protection
        // SameSite=Strict prevents CSRF attacks
        const stateCookie = `oauth_state=${encodeURIComponent(
          state,
        )}; HttpOnly; Path=/; Max-Age=${10 * 60}; SameSite=Strict${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`

        // Build OAuth URL based on provider
        let authUrl: string
        // Use SITE_URL env var if set, otherwise fall back to request origin
        const origin = env.SITE_URL || new URL(request.url).origin
        const redirectUri = `${origin}/api/auth/callback/${provider}`

        if (provider === 'github') {
          const clientId = env.GITHUB_OAUTH_CLIENT_ID
          if (!clientId) {
            throw new Error('GITHUB_OAUTH_CLIENT_ID is not configured')
          }
          authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
            clientId,
          )}&redirect_uri=${encodeURIComponent(
            redirectUri,
          )}&scope=user:email&state=${state}`
        } else {
          // Google
          const clientId = env.GOOGLE_OAUTH_CLIENT_ID
          if (!clientId) {
            throw new Error('GOOGLE_OAUTH_CLIENT_ID is not configured')
          }
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
            clientId,
          )}&redirect_uri=${encodeURIComponent(
            redirectUri,
          )}&response_type=code&scope=openid email profile&state=${state}`
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
