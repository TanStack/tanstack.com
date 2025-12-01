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
import { getEffectiveCapabilities } from './capabilities'

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth

// Helper to ensure userId is properly typed
// This validates at runtime and narrows the type
// Note: Type assertion is necessary because Id<'users'> is a branded type,
// but we validate at runtime that userId is a non-null string
function getUserId(userId: string | null | undefined): Id<'users'> {
  if (!userId) {
    throw new Error('User ID is required')
  }
  return userId as Id<'users'>
}

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
        await ctx.db.patch(getUserId(authUser.userId), {
          email: authUser.email,
          updatedAt: authUser.updatedAt,
          displayUsername: authUser.displayUsername ?? '',
          image: authUser.image ?? '',
          name: authUser.name,
        })
      },
      onDelete: async (ctx, authUser) => {
        await ctx.db.delete(getUserId(authUser.userId))
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
      github:
        process.env.GITHUB_OAUTH_CLIENT_ID &&
        process.env.GITHUB_OAUTH_CLIENT_SECRET
          ? {
              clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
              clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
            }
          : undefined,
      google:
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
          ? {
              clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
              clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            }
          : undefined,
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
  const userMetaData = await ctx.db.get(getUserId(user.userId))

  // Get effective capabilities (direct + role-based)
  const capabilities = await getEffectiveCapabilities(
    ctx,
    getUserId(user.userId)
  )

  return {
    ...user,
    ...userMetaData,
    capabilities,
  }
}

export type TanStackUser = Awaited<ReturnType<typeof getBetterAuthUser>> &
  Infer<typeof schema.tables.users.validator>

function getBetterAuthUser(ctx: QueryCtx) {
  return authComponent.safeGetAuthUser(ctx)
}
