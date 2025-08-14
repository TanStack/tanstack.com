import { createAuth } from './auth'
import { reactStartHelpers } from '@convex-dev/better-auth/react-start'

// CONVEX_SITE_URL should be the URL of your application, not the Convex backend
const convexSiteUrl =
  process.env.CONVEX_SITE_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://tanstack.com'
    : 'http://localhost:3005')

export const { fetchSession, reactStartHandler, getCookieName } =
  reactStartHelpers(createAuth, {
    convexSiteUrl,
  })
