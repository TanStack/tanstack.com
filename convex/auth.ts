import {
  createClient,
  GenericCtx,
  type AuthFunctions,
} from '@convex-dev/better-auth'
import { components, internal } from './_generated/api'
import { query, QueryCtx } from './_generated/server'
import type { Id, DataModel } from './_generated/dataModel'
import schema from './schema'

import { Infer } from 'convex/values'
import { betterAuth } from 'better-auth'
import { convex } from '@convex-dev/better-auth/plugins'

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth

// Initialize the component
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        const userId = await ctx.db.insert('users', {
          createdAt: authUser.createdAt,
          email: authUser.email,
          updatedAt: authUser.updatedAt,
          displayUsername: authUser.displayUsername ?? '',
          image: authUser.image ?? '',
          name: authUser.name,
          capabilities: [],
        })
        await authComponent.setUserId(ctx, authUser._id, userId)
      },
      onUpdate: async (ctx, authUser) => {
        await ctx.db.patch(authUser.userId as Id<'users'>, {
          email: authUser.email,
          updatedAt: authUser.updatedAt,
          displayUsername: authUser.displayUsername ?? '',
          image: authUser.image ?? '',
          name: authUser.name,
        })
      },
      onDelete: async (ctx, authUser) => {
        await ctx.db.delete(authUser.userId as Id<'users'>)
      },
    },
  },
})

// You'll want to replace this with an environment variable
const siteUrl = process.env.URL

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) => {
  return betterAuth({
    // All auth requests will be proxied through your TanStack Start server
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),

    // When createAuth is called just to generate options, we don't want to
    // log anything
    logger: {
      disabled: optionsOnly,
    },

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
}
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return getCurrentUserConvex(ctx)
  },
})

export async function getCurrentUserConvex(ctx: QueryCtx) {
  // Get user data from Better Auth - email, name, image, etc.
  const user = await getBetterAuthUser(ctx)

  if (!user) {
    return null
  }
  // Get user data from your application's database
  // (skip this if you have no fields in your users table schema)
  const userMetaData = await ctx.db.get(user.userId as Id<'users'>)
  return {
    ...user,
    ...userMetaData,
  } as TanStackUser
}

export type TanStackUser = Awaited<ReturnType<typeof getBetterAuthUser>> &
  Infer<typeof schema.tables.users.validator>

function getBetterAuthUser(ctx: QueryCtx) {
  return authComponent.safeGetAuthUser(ctx)
}
