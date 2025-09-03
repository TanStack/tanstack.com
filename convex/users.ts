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
    emailFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    await requireCapability(ctx, 'admin')

    const limit = args.pagination.limit
    const cursor = args.pagination.cursor ?? null

    if (args.emailFilter && args.emailFilter.length > 0) {
      const start = args.emailFilter
      const end = start + '\uffff'
      // Prefix range over email using index
      return await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.gte('email', start))
        .filter((q) => q.lt(q.field('email'), end))
        .paginate({
          numItems: limit,
          cursor,
        })
    }

    // Return paginated users without filter
    return await ctx.db.query('users').order('desc').paginate({
      numItems: limit,
      cursor,
    })
  },
})

export const countUsers = query({
  args: {
    emailFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    await requireCapability(ctx, 'admin')

    const total = (await ctx.db.query('users').collect()).length

    if (args.emailFilter && args.emailFilter.length > 0) {
      const start = args.emailFilter
      const end = start + '\uffff'
      const filtered = (
        await ctx.db
          .query('users')
          .withIndex('by_email', (q) => q.gte('email', start))
          .filter((q) => q.lt(q.field('email'), end))
          .collect()
      ).length
      return { total, filtered }
    }

    return { total, filtered: total }
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

// Admin override to set a user's adsDisabled flag
export const adminSetAdsDisabled = mutation({
  args: {
    userId: v.id('users'),
    adsDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    await requireCapability(ctx, 'admin')

    // Validate that target user exists
    const targetUser = await ctx.db.get(args.userId)
    if (!targetUser) {
      throw new Error('Target user not found')
    }

    // Update target user's adsDisabled flag
    await ctx.db.patch(args.userId, {
      adsDisabled: args.adsDisabled,
    })

    return { success: true }
  },
})
