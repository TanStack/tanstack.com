import { createFileRoute } from '@tanstack/react-router'
import { env } from '~/utils/env'
import {
  getOAuthStateCookie,
  clearOAuthStateCookie,
  isOAuthPopupMode,
  clearOAuthPopupCookie,
  getOAuthReturnTo,
  clearOAuthReturnToCookie,
  getSessionService,
  getOAuthService,
  getUserRepository,
  exchangeGitHubCode,
  exchangeGoogleCode,
  fetchGitHubProfile,
  fetchGoogleProfile,
  SESSION_DURATION_MS,
  SESSION_MAX_AGE_SECONDS,
} from '~/auth/index.server'
import { recordLogin } from '~/utils/audit.server'
import { recordDailyActivity } from '~/utils/activity.server'

export const Route = createFileRoute('/api/auth/callback/$provider')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { provider: string } }) => {
        const isProduction = process.env.NODE_ENV === 'production'

        try {
          const provider = params.provider as 'github' | 'google'
          const url = new URL(request.url)
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')
          const error = url.searchParams.get('error')

          if (error) {
            console.error(
              `[AUTH:ERROR] OAuth error received from provider: ${error}`,
            )
            return Response.redirect(
              new URL('/login?error=oauth_failed', request.url),
              302,
            )
          }

          if (!code || !state) {
            console.error(
              '[AUTH:ERROR] Missing code or state in OAuth callback',
            )
            return Response.redirect(
              new URL('/login?error=oauth_failed', request.url),
              302,
            )
          }

          // Validate state from HTTPS-only cookie (CSRF protection)
          const cookieState = getOAuthStateCookie(request)

          if (!cookieState) {
            console.error(
              '[AUTH:ERROR] No state cookie found - possible CSRF or cookie issue',
            )
            return Response.redirect(
              new URL('/login?error=oauth_failed', request.url),
              302,
            )
          }

          if (cookieState !== state) {
            console.error(
              `[AUTH:ERROR] State mismatch - expected: ${cookieState.substring(0, 10)}..., received: ${state.substring(0, 10)}...`,
            )
            return Response.redirect(
              new URL('/login?error=oauth_failed', request.url),
              302,
            )
          }

          // Clear state cookie (one-time use)
          const clearStateCookieHeader = clearOAuthStateCookie(isProduction)

          // Exchange code for access token
          const origin = env.SITE_URL || new URL(request.url).origin
          const redirectUri = `${origin}/api/auth/callback/${provider}`

          let userProfile: {
            id: string
            email: string
            name?: string
            image?: string
          }
          let tokenInfo: { accessToken: string; scope: string } | undefined

          if (provider === 'github') {
            const clientId = env.GITHUB_OAUTH_CLIENT_ID
            const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET
            if (!clientId || !clientSecret) {
              throw new Error('GitHub OAuth credentials not configured')
            }

            const githubToken = await exchangeGitHubCode(
              code,
              clientId,
              clientSecret,
              redirectUri,
            )
            tokenInfo = githubToken
            userProfile = await fetchGitHubProfile(githubToken.accessToken)
          } else {
            // Google
            const clientId = env.GOOGLE_OAUTH_CLIENT_ID
            const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET
            if (!clientId || !clientSecret) {
              throw new Error('Google OAuth credentials not configured')
            }

            const accessToken = await exchangeGoogleCode(
              code,
              clientId,
              clientSecret,
              redirectUri,
            )
            userProfile = await fetchGoogleProfile(accessToken)
          }

          // Upsert user and OAuth account
          const oauthService = getOAuthService()
          const result = await oauthService.upsertOAuthAccount(
            provider,
            userProfile,
            tokenInfo,
          )

          // Get user to access sessionVersion
          const userRepository = getUserRepository()
          const user = await userRepository.findById(result.userId)

          if (!user) {
            console.error(
              `[AUTH:ERROR] User ${result.userId} not found after OAuth account creation for ${provider}:${userProfile.id} (${userProfile.email})`,
            )
            throw new Error('User not found after OAuth account creation')
          }

          // Record login event and daily activity (fire and forget, don't block auth flow)
          Promise.all([
            recordLogin({
              userId: user.id,
              provider,
              isNewUser: result.isNewUser,
              request,
            }),
            recordDailyActivity(user.id),
          ]).catch((err) => {
            console.error('[AUTH:WARN] Failed to record login/activity event:', err)
          })

          // Create signed session cookie
          const sessionService = getSessionService()
          const expiresAt = Date.now() + SESSION_DURATION_MS
          const signedCookie = await sessionService.signCookie({
            userId: user.id,
            expiresAt,
            version: user.sessionVersion,
          })

          const sessionCookie = sessionService.createSessionCookieHeader(
            signedCookie,
            SESSION_MAX_AGE_SECONDS,
          )

          // Check if this was a popup OAuth flow
          const isPopup = isOAuthPopupMode(request)

          // Check for custom returnTo URL
          const returnTo = getOAuthReturnTo(request)

          let redirectUrl: string
          if (isPopup) {
            redirectUrl = new URL('/auth/popup-success', request.url).toString()
          } else if (returnTo) {
            // Validate returnTo is a same-origin URL to prevent open redirect
            try {
              const returnToUrl = new URL(returnTo, request.url)
              const currentOrigin = new URL(request.url).origin
              if (returnToUrl.origin === currentOrigin) {
                redirectUrl = returnToUrl.toString()
              } else {
                console.warn(`[AUTH:WARN] returnTo origin mismatch: ${returnToUrl.origin} !== ${currentOrigin}`)
                redirectUrl = new URL('/account', request.url).toString()
              }
            } catch (e) {
              console.warn(`[AUTH:WARN] Failed to parse returnTo URL: ${returnTo}`, e)
              redirectUrl = new URL('/account', request.url).toString()
            }
          } else {
            redirectUrl = new URL('/account', request.url).toString()
          }

          // Return Response with Set-Cookie headers and redirect
          const headers = new Headers()
          headers.set('Location', redirectUrl)
          headers.append('Set-Cookie', clearStateCookieHeader)
          headers.append('Set-Cookie', sessionCookie)
          if (isPopup) {
            headers.append('Set-Cookie', clearOAuthPopupCookie(isProduction))
          }
          if (returnTo) {
            headers.append('Set-Cookie', clearOAuthReturnToCookie(isProduction))
          }

          return new Response(null, {
            status: 302,
            headers,
          })
        } catch (err) {
          console.error('[AUTH:ERROR] OAuth callback failed:', {
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            provider: params.provider,
          })
          return Response.redirect(
            new URL('/login?error=oauth_failed', request.url),
            302,
          )
        }
      },
    },
  },
})
