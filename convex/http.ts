import { ossStats } from './stats'
import { httpRouter } from 'convex/server'

import { betterAuthComponent } from './auth'

import { convexAdapter } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { reactStartHelpers } from '@convex-dev/better-auth/react-start'
import { GenericCtx } from './_generated/server'

// You'll want to replace this with an environment variable
const siteUrl = process.env.URL

const http = httpRouter()

const createAuth = (ctx: GenericCtx) =>
  betterAuth({
    // All auth requests will be proxied through your TanStack Start server
    baseURL: siteUrl,
    database: convexAdapter(ctx, betterAuthComponent),

    // Simple non-verified email/password to get started
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_OAUTH_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
      },
      google: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
      },
    },
    plugins: [
      // The Convex plugin is required
      convex(),
    ],
  })

ossStats.registerRoutes(http)
betterAuthComponent.registerRoutes(http, createAuth)

export const { fetchSession, reactStartHandler, getCookieName } =
  reactStartHelpers(createAuth, {
    convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
  })

export default http
