import {
  BetterAuth,
  type AuthFunctions,
  type PublicAuthFunctions,
} from '@convex-dev/better-auth'
import { api, components, internal } from './_generated/api'
import { query, QueryCtx } from './_generated/server'
import type { Id, DataModel } from './_generated/dataModel'
import schema from './schema'

import { Infer } from 'convex/values'

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth
const publicAuthFunctions: PublicAuthFunctions = api.auth

// Initialize the component
export const betterAuthComponent = new BetterAuth(components.betterAuth, {
  authFunctions,
  publicAuthFunctions,
})

// These are required named exports
export const {
  createUser,
  updateUser,
  deleteUser,
  createSession,
  isAuthenticated,
} = betterAuthComponent.createAuthFunctions<DataModel>({
  // Must create a user and return the user id
  onCreateUser: async (ctx, user) => {
    return ctx.db.insert('users', {
      createdAt: user.createdAt,
      email: user.email,
      updatedAt: user.updatedAt,
      displayUsername: user.displayUsername ?? '',
      image: user.image ?? '',
      name: user.name,
      capabilities: [],
    })
  },

  // Delete the user when they are deleted from Better Auth
  onDeleteUser: async (ctx, userId) => {
    await ctx.db.delete(userId as Id<'users'>)
  },

  onUpdateUser: async (ctx, user) => {
    await ctx.db.patch(user.userId as Id<'users'>, {
      email: user.email,
      updatedAt: user.updatedAt,
      displayUsername: user.displayUsername ?? '',
      image: user.image ?? '',
      name: user.name,
    })
  },
})

export type TanStackUser = Awaited<ReturnType<typeof getBetterAuthUser>> &
  Infer<typeof schema.tables.users.validator>

function getBetterAuthUser(ctx: QueryCtx) {
  return betterAuthComponent.getAuthUser(ctx)
}

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
