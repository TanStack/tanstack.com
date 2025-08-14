import { betterAuth } from 'better-auth'
import { convexAdapter } from '@convex-dev/better-auth'
import { betterAuthComponent } from '../../convex/auth'
import type { GenericCtx } from '../../convex/_generated/server'

export const createAuth = (ctx: GenericCtx) =>
  betterAuth({
    baseURL:
      process.env.NODE_ENV === 'production'
        ? 'https://tanstack.com'
        : 'http://localhost:3003', // Updated to match current dev server port
    database: convexAdapter(ctx, betterAuthComponent),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    user: {
      additionalFields: {
        adsDisabled: {
          type: 'boolean',
          defaultValue: false,
        },
      },
    },
  })
