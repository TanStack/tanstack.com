import { createAuth } from './auth'
import { reactStartHelpers } from '@convex-dev/better-auth/react-start'
import { env } from '../utils/env'

export const { fetchSession, reactStartHandler, getCookieName } =
  reactStartHelpers(createAuth, {
    convexSiteUrl: env.VITE_CONVEX_SITE_URL,
  })
