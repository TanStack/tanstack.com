import { createFileRoute } from '@tanstack/react-router'
import { env } from '~/utils/env'
import { upsertOAuthAccount } from '~/utils/oauth.server'
import { signCookie } from '~/utils/cookies.server'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/auth/callback/$provider')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {

          const provider = params.provider as 'github' | 'google'
          const url = new URL(request.url)
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')
          const error = url.searchParams.get('error')

          if (error) {
            console.error(`[AUTH:ERROR] OAuth error received from provider: ${error}`)
            return Response.redirect(new URL('/login?error=oauth_failed', request.url), 302)
          }

          if (!code || !state) {
            console.error('[AUTH:ERROR] Missing code or state in OAuth callback')
            return Response.redirect(new URL('/login?error=oauth_failed', request.url), 302)
          }

          // Validate state from HTTPS-only cookie (CSRF protection)
          const cookies = request.headers.get('cookie') || ''
          const stateCookie = cookies
            .split(';')
            .find((c) => c.trim().startsWith('oauth_state='))

          if (!stateCookie) {
            console.error('[AUTH:ERROR] No state cookie found - possible CSRF or cookie issue')
            return Response.redirect(new URL('/login?error=oauth_failed', request.url), 302)
          }

          const cookieState = decodeURIComponent(stateCookie.split('=').slice(1).join('=').trim())

          if (cookieState !== state) {
            console.error(`[AUTH:ERROR] State mismatch - expected: ${cookieState.substring(0, 10)}..., received: ${state.substring(0, 10)}...`)
            return Response.redirect(new URL('/login?error=oauth_failed', request.url), 302)
          }

          // Clear state cookie (one-time use)
          const clearStateCookie = `oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`

        // Exchange code for access token
        // Use SITE_URL env var if set, otherwise fall back to request origin
        const origin = env.SITE_URL || new URL(request.url).origin
        const redirectUri = `${origin}/api/auth/callback/${provider}`
        let accessToken: string
        let userProfile: {
          id: string
          email: string
          name?: string
          image?: string
        }

        if (provider === 'github') {
          const clientId = env.GITHUB_OAUTH_CLIENT_ID
          const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET
          if (!clientId || !clientSecret) {
            throw new Error('GitHub OAuth credentials not configured')
          }

          // Exchange code for token
          const tokenResponse = await fetch(
            'https://github.com/login/oauth/access_token',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
              }),
            }
          )

          const tokenData = await tokenResponse.json()
          if (tokenData.error) {
            console.error(`[AUTH:ERROR] GitHub token exchange failed: ${tokenData.error}, description: ${tokenData.error_description || 'none'}`)
            throw new Error(`GitHub OAuth error: ${tokenData.error}`)
          }

          if (!tokenData.access_token) {
            console.error('[AUTH:ERROR] GitHub token exchange succeeded but no access_token returned')
            throw new Error('No access token received from GitHub')
          }

          accessToken = tokenData.access_token
          // Fetch user profile
          const profileResponse = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          })

          const profile = await profileResponse.json()

          // Fetch email (may require separate call)
          let email = profile.email
          if (!email) {
            const emailResponse = await fetch(
              'https://api.github.com/user/emails',
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              }
            )
            const emails = await emailResponse.json()
            const primaryEmail = emails.find((e: any) => e.primary && e.verified)
            const verifiedEmail = emails.find((e: any) => e.verified)
            email = primaryEmail?.email || verifiedEmail?.email
          }
          
          if (!email) {
            console.error(`[AUTH:ERROR] No verified email found for GitHub user ${profile.id} (${profile.login})`)
            throw new Error('No verified email found for GitHub account')
          }

          userProfile = {
            id: String(profile.id),
            email: email,
            name: profile.name || profile.login,
            image: profile.avatar_url,
          }
        } else {
          // Google
          const clientId = env.GOOGLE_OAUTH_CLIENT_ID
          const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET
          if (!clientId || !clientSecret) {
            throw new Error('Google OAuth credentials not configured')
          }

          // Exchange code for token
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }),
          })

          const tokenData = await tokenResponse.json()
          if (tokenData.error) {
            console.error(`[AUTH:ERROR] Google token exchange failed: ${tokenData.error}, description: ${tokenData.error_description || 'none'}`)
            throw new Error(`Google OAuth error: ${tokenData.error}`)
          }

          if (!tokenData.access_token) {
            console.error('[AUTH:ERROR] Google token exchange succeeded but no access_token returned')
            throw new Error('No access token received from Google')
          }

          accessToken = tokenData.access_token

          // Fetch user profile
          const profileResponse = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          const profile = await profileResponse.json()
          
          if (!profile.verified_email) {
            console.error(`[AUTH:ERROR] Google email not verified for user ${profile.id} (${profile.email})`)
            throw new Error('Google email not verified')
          }
          
          userProfile = {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            image: profile.picture,
          }
        }

        // Upsert user and OAuth account
        const result = await upsertOAuthAccount(provider, userProfile)

        // Get user to access sessionVersion
        const user = await db.query.users.findFirst({
          where: eq(users.id, result.userId),
        })

        if (!user) {
          console.error(`[AUTH:ERROR] User ${result.userId} not found after OAuth account creation for ${provider}:${userProfile.id} (${userProfile.email})`)
          throw new Error('User not found after OAuth account creation')
        }

        // Create signed cookie (30 days expiration)
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000
        const signedCookie = await signCookie({
          userId: user.id,
          expiresAt,
          version: user.sessionVersion,
        })

        // Set session cookie (30 days, HTTP-only, Secure in prod)
        // Note: Domain is omitted to allow cookie to work on localhost and production
        // URL-encode the cookie value to handle any special characters
        const sessionCookie = `session_token=${encodeURIComponent(signedCookie)}; HttpOnly; Path=/; Max-Age=${
          30 * 24 * 60 * 60
        }; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        
        // Return Response with Set-Cookie headers and redirect
        // Clear state cookie and set session cookie
        const accountUrl = new URL('/account', request.url).toString()
        const headers = new Headers()
        headers.set('Location', accountUrl)
        headers.append('Set-Cookie', clearStateCookie)
        headers.append('Set-Cookie', sessionCookie)
        
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
          return Response.redirect(new URL('/login?error=oauth_failed', request.url), 302)
        }
      },
    },
  },
})

