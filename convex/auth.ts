import {
  AuthFunctions,
  BetterAuth,
  PublicAuthFunctions,
} from '@convex-dev/better-auth'
import { api, components, internal } from './_generated/api'
import { query } from './_generated/server'
import { DataModel, Id } from './_generated/dataModel'

const authFunctions: AuthFunctions = internal.auth
const publicAuthFunctions: PublicAuthFunctions = api.auth

export const betterAuthComponent = new BetterAuth(components.betterAuth, {
  authFunctions,
  publicAuthFunctions,
  verbose: true,
})

export const {
  createUser,
  deleteUser,
  updateUser,
  createSession,
  isAuthenticated,
} = betterAuthComponent.createAuthFunctions<DataModel>({
  onCreateUser: async (ctx, user) => {
    // Create user in our application users table
    const userId = await ctx.db.insert('users', {
      email: user.email,
      adsDisabled: false,
    })

    // This function must return the user id
    return userId
  },
  onDeleteUser: async (ctx, userId) => {
    // Delete the user's data if the user is being deleted
    await ctx.db.delete(userId as Id<'users'>)
  },
  onUpdateUser: async (ctx, user) => {
    // Keep the user's email synced
    const userId = user.userId as Id<'users'>
    await ctx.db.patch(userId, {
      email: user.email,
    })
  },
})

// Function for getting the current user with app data
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // Get user data from Better Auth - email, name, image, etc.
    const userMetadata = await betterAuthComponent.getAuthUser(ctx)
    if (!userMetadata) {
      return null
    }
    // Get user data from your application's database
    const user = await ctx.db.get(userMetadata.userId as Id<'users'>)
    return {
      ...user,
      ...userMetadata,
    }
  },
})
