import { v } from 'convex/values'
import { mutation, query, QueryCtx } from './_generated/server'
import { Capability, CapabilitySchema } from './schema'
import { getCurrentUserConvex } from './auth'
import { Id } from './_generated/dataModel'

export const updateUserCapabilities = mutation({
  args: {
    userId: v.id('users'),
    capabilities: v.array(
      v.union(v.literal('admin'), v.literal('disableAds'), v.literal('builder'))
    ),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    await requireCapability(ctx, 'admin')

    // Validate that target user exists
    const targetUser = await ctx.db.get(args.userId)
    if (!targetUser) {
      throw new Error('Target user not found')
    }

    let capabilities = args.capabilities

    // Ensure that tannerlinsley@gmail.com always has the admin capability
    // as a fail safe
    if (targetUser.email === 'tannerlinsley@gmail.com') {
      capabilities = [
        ...new Set<Capability>(['admin', ...capabilities]).values(),
      ]
    }

    // Validate capabilities using schema helper
    const validatedCapabilities = CapabilitySchema.array().parse(capabilities)

    // Update target user's capabilities
    await ctx.db.patch(args.userId, {
      capabilities: validatedCapabilities,
    })

    return { success: true }
  },
})

// List users with pagination (admin only)
export const listUsers = query({
  args: {
    pagination: v.object({
      limit: v.number(),
      cursor: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    await requireCapability(ctx, 'admin')

    // Return paginated users
    return await ctx.db
      .query('users')
      .order('desc')
      .paginate({
        numItems: args.pagination.limit,
        cursor: args.pagination.cursor ?? null,
      })
  },
})

// Helper function to validate user capability
async function requireCapability(ctx: QueryCtx, capability: Capability) {
  // Get the current user (caller)
  const currentUser = await getCurrentUserConvex(ctx)
  if (!currentUser) {
    throw new Error('Not authenticated')
  }

  // Validate that caller has the required capability
  if (!currentUser.capabilities.includes(capability)) {
    throw new Error(`${capability} capability required`)
  }

  return { currentUser }
}

// Toggle ad preference (only for users with disableAds capability)
export const updateAdPreference = mutation({
  args: {
    adsDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    const { currentUser } = await requireCapability(ctx, 'disableAds')

    // Update target user's capabilities
    await ctx.db.patch(currentUser.userId as Id<'users'>, {
      adsDisabled: args.adsDisabled,
    })

    return { success: true }
  },
})
