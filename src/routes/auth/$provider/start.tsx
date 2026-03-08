import { createFileRoute } from '@tanstack/react-router'
import { env } from '~/utils/env'
import {
  generateOAuthState,
  createOAuthStateCookie,
  createOAuthPopupCookie,
  createOAuthReturnToCookie,
  buildGitHubAuthUrl,
  buildGoogleAuthUrl,
} from '~/auth/index.server'

export const Route = createFileRoute('/auth/$provider/start')({
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

        // Check if this is a popup OAuth flow
        const url = new URL(request.url)
        const isPopup = url.searchParams.get('popup') === 'true'
        const popupCookie = isPopup
          ? createOAuthPopupCookie(isProduction)
          : null

        // Check for returnTo URL (for redirect after auth)
        const returnTo = url.searchParams.get('returnTo')
        const returnToCookie = returnTo
          ? createOAuthReturnToCookie(returnTo, isProduction)
          : null

        if (returnTo) {
          console.log(`[AUTH:INFO] Setting returnTo cookie for: ${returnTo}`)
        }

        // Build OAuth URL based on provider
        const origin = env.SITE_URL || new URL(request.url).origin
        const redirectUri = `${origin}/api/auth/callback/${provider}`

        // Check for additional scopes (e.g., public_repo for deploy flow)
        const additionalScopes =
          url.searchParams.get('scope')?.split(',').filter(Boolean) ?? []

        let authUrl: string

        if (provider === 'github') {
          const clientId = env.GITHUB_OAUTH_CLIENT_ID
          if (!clientId) {
            throw new Error('GITHUB_OAUTH_CLIENT_ID is not configured')
          }
          authUrl = buildGitHubAuthUrl(
            clientId,
            redirectUri,
            state,
            additionalScopes,
          )
        } else {
          // Google
          const clientId = env.GOOGLE_OAUTH_CLIENT_ID
          if (!clientId) {
            throw new Error('GOOGLE_OAUTH_CLIENT_ID is not configured')
          }
          authUrl = buildGoogleAuthUrl(clientId, redirectUri, state)
        }

        // Return redirect with state cookie set
        const headers = new Headers()
        headers.set('Location', authUrl)
        headers.append('Set-Cookie', stateCookie)
        if (popupCookie) {
          headers.append('Set-Cookie', popupCookie)
        }
        if (returnToCookie) {
          headers.append('Set-Cookie', returnToCookie)
        }

        return new Response(null, {
          status: 302,
          headers,
        })
      },
    },
  },
})
