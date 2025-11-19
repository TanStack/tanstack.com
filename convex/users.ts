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
      page: v.optional(v.number()),
    }),
    emailFilter: v.optional(v.string()),
    nameFilter: v.optional(v.string()),
    capabilityFilter: v.optional(
      v.array(
        v.union(v.literal('admin'), v.literal('disableAds'), v.literal('builder'))
      )
    ),
    noCapabilitiesFilter: v.optional(v.boolean()),
    adsDisabledFilter: v.optional(v.boolean()),
    interestedInHidingAdsFilter: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate admin capability
    await requireCapability(ctx, 'admin')

    const limit = args.pagination.limit
    const pageIndex = args.pagination.page ?? 0

    const emailFilter = args.emailFilter ?? ''

    // Collect users (email search when provided), then filter/sort in-memory
    const candidates =
      emailFilter && emailFilter.length > 0
        ? await ctx.db
            .query('users')
            .withSearchIndex('search_email', (q2) =>
              q2.search('email', emailFilter)
            )
            .collect()
        : await ctx.db.query('users').collect()

    // Stable newest-first ordering
    candidates.sort((a: any, b: any) => b._creationTime - a._creationTime)

    const filtered = candidates.filter((user: any) => {
      // Name filter (in-memory search on name and displayUsername)
      if (args.nameFilter && args.nameFilter.length > 0) {
        const name = (user.name || user.displayUsername || '').toLowerCase()
        const searchTerm = args.nameFilter.toLowerCase()
        if (!name.includes(searchTerm)) {
          return false
        }
      }

      // No capabilities filter
      if (args.noCapabilitiesFilter === true) {
        if (
          !Array.isArray(user.capabilities) ||
          user.capabilities.length > 0
        ) {
          return false
        }
      }

      if (args.capabilityFilter && args.capabilityFilter.length > 0) {
        if (
          !Array.isArray(user.capabilities) ||
          !args.capabilityFilter.some((cap) => user.capabilities.includes(cap))
        ) {
          return false
        }
      }
      if (typeof args.adsDisabledFilter === 'boolean') {
        if (Boolean(user.adsDisabled) !== args.adsDisabledFilter) return false
      }
      if (typeof args.interestedInHidingAdsFilter === 'boolean') {
        if (Boolean(user.interestedInHidingAds) !== args.interestedInHidingAdsFilter) return false
      }
      return true
    })

    const start = Math.max(0, pageIndex * limit)
    const end = start + limit
    const page = filtered.slice(start, end)
    const hasMore = end < filtered.length

    return {
      page,
      isDone: !hasMore,
      counts: {
        total: (await ctx.db.query('users').collect()).length,
        filtered: filtered.length,
        pages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    }
  },
})

// countUsers removed; counts are included in listUsers response

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

// Set interest in hiding ads (for opt-in waitlist)
export const setInterestedInHidingAds = mutation({
  args: {
    interested: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserConvex(ctx)
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Update user's interestedInHidingAds flag
    await ctx.db.patch(user.userId as Id<'users'>, {
      interestedInHidingAds: args.interested,
    })

    return { success: true }
  },
})
