import { reactStartHelpers } from '@convex-dev/better-auth/react-start'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getWebRequest } from '@tanstack/react-start/server'

import { env } from '../utils/env'

import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuth } from './auth.isomorphic'

// Server side session request
export const fetchServerAuth = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionCookieName = await getCookieName()
    const token = getCookie(sessionCookieName)
    const request = getWebRequest()
    const { session } = await fetchSession(request)
    return {
      userId: session?.user.id,
      token,
    }
  }
)

export const { fetchSession, reactStartHandler, getCookieName } =
  reactStartHelpers(createAuth, {
    convexSiteUrl: env.VITE_CONVEX_SITE_URL,
  })

export const authClient = createAuthClient({
  plugins: [convexClient()],
})
