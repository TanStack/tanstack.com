import { createServerFn } from '@tanstack/react-start'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { eq, and, or, ilike, sql } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import { getBulkEffectiveCapabilities } from './capabilities.server'
import { z } from 'zod'
import type { Capability } from '~/db/schema'

// Helper function to validate user capability
// Optimized: getEffectiveCapabilities is already called in getAuthenticatedUser,
// so we can reuse the capabilities from there
const requireCapability = createServerFn({ method: 'POST' })
  .inputValidator((data: { capability: string }) => ({
    capability: data.capability as Capability,
  }))
  .handler(async ({ data: { capability } }) => {
    const user = await getAuthenticatedUser()

    // User already has capabilities from getAuthenticatedUser
    // Validate that caller has the required capability
    if (!user.capabilities.includes(capability)) {
      throw new Error(`${capability} capability required`)
    }

    return { currentUser: user }
  })

// Server function wrapper for listUsers
export const listUsers = createServerFn({ method: 'POST' })
  .inputValidator(
    z
      .object({
        pagination: z.object({
          limit: z.number(),
          page: z.number().optional(),
        }),
        emailFilter: z.string().optional(),
        nameFilter: z.string().optional(),
        capabilityFilter: z.array(z.string()).optional(),
        noCapabilitiesFilter: z.boolean().optional(),
        adsDisabledFilter: z.boolean().optional(),
        interestedInHidingAdsFilter: z.boolean().optional(),
        useEffectiveCapabilities: z.boolean().optional().default(true),
      })
      .transform((data) => ({
        ...data,
        capabilityFilter: data.capabilityFilter as Capability[] | undefined,
      })),
  )
  .handler(async ({ data }) => {
    if (!data || !data.pagination) {
      throw new Error('Missing required')
    }

    const startTime = Date.now()

    // Validate admin capability
    await requireCapability({ data: { capability: 'admin' } })
    const authTime = Date.now() - startTime

    const limit = data.pagination.limit
    const pageIndex = data.pagination.page ?? 0
    const useEffectiveCapabilities = data.useEffectiveCapabilities ?? true

    // Build query conditions (excluding capability filters if using effective capabilities)
    const conditions = []

    // Email filter (case-insensitive search)
    if (data.emailFilter && data.emailFilter.length > 0) {
      conditions.push(ilike(users.email, `%${data.emailFilter}%`))
    }

    // Name filter (search in name or displayUsername)
    if (data.nameFilter && data.nameFilter.length > 0) {
      const nameLower = data.nameFilter.toLowerCase()
      conditions.push(
        or(
          sql`LOWER(${users.name}) LIKE ${`%${nameLower}%`}`,
          sql`LOWER(${users.displayUsername}) LIKE ${`%${nameLower}%`}`,
        ),
      )
    }

    // No capabilities filter - only apply if using direct capabilities
    if (data.noCapabilitiesFilter === true && !useEffectiveCapabilities) {
      conditions.push(sql`array_length(${users.capabilities}, 1) IS NULL`)
    }

    // Capability filter - only apply SQL filter if using direct capabilities
    if (
      data.capabilityFilter &&
      data.capabilityFilter.length > 0 &&
      !useEffectiveCapabilities
    ) {
      // Use PostgreSQL array overlap operator (&&)
      // Check if user's capabilities array overlaps with filter array
      // Format: ARRAY['admin', 'feed']::capability[]
      const filterArrayValues = data.capabilityFilter
        .map((c) => `'${c}'`)
        .join(',')
      conditions.push(
        sql`${users.capabilities} && ARRAY[${sql.raw(
          filterArrayValues,
        )}]::capability[]`,
      )
    }

    // Ads disabled filter
    if (typeof data.adsDisabledFilter === 'boolean') {
      conditions.push(eq(users.adsDisabled, data.adsDisabledFilter))
    }

    // Interested in hiding ads filter
    if (typeof data.interestedInHidingAdsFilter === 'boolean') {
      conditions.push(
        eq(users.interestedInHidingAds, data.interestedInHidingAdsFilter),
      )
    }

    // Get filtered users with proper SQL pagination
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const queryStartTime = Date.now()

    // If filtering by effective capabilities, we need to fetch all matching users first,
    // then filter by effective capabilities in memory, then paginate
    let allMatchingUsers: any[] = []
    let filteredUsers: any[] = []

    if (useEffectiveCapabilities && (data.capabilityFilter?.length || data.noCapabilitiesFilter)) {
      // Fetch all users matching other filters (without pagination)
      allMatchingUsers = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(sql`${users.createdAt} DESC`)

      // Get effective capabilities for all matching users
      const userIds = allMatchingUsers.map((u) => u.id)
      const effectiveCapabilitiesMap =
        userIds.length > 0
          ? await getBulkEffectiveCapabilities(userIds)
          : {}

      // Filter by effective capabilities
      filteredUsers = allMatchingUsers.filter((user) => {
        const effectiveCapabilities = effectiveCapabilitiesMap[user.id] || []

        // No capabilities filter
        if (data.noCapabilitiesFilter === true) {
          return effectiveCapabilities.length === 0
        }

        // Capability filter
        if (data.capabilityFilter && data.capabilityFilter.length > 0) {
          // Check if effective capabilities overlap with filter
          return data.capabilityFilter.some((cap) =>
            effectiveCapabilities.includes(cap),
          )
        }

        return true
      })

      // Apply pagination to filtered results
      const offset = Math.max(0, pageIndex * limit)
      const page = filteredUsers.slice(offset, offset + limit)
      const filteredCount = filteredUsers.length
      const hasMore = offset + limit < filteredCount

      const selectTime = Date.now() - queryStartTime
      const totalTime = Date.now() - startTime

      // Log performance metrics
      if (totalTime > 1000) {
        console.warn(`[listUsers] Slow query detected (effective capabilities):`, {
          authTime: `${authTime}ms`,
          selectTime: `${selectTime}ms`,
          totalTime: `${totalTime}ms`,
          filters: {
            emailFilter: !!data.emailFilter,
            nameFilter: !!data.nameFilter,
            capabilityFilter: !!data.capabilityFilter,
            noCapabilitiesFilter: data.noCapabilitiesFilter,
            useEffectiveCapabilities: true,
          },
          pagination: { limit, pageIndex, offset },
          resultCount: page.length,
          totalMatching: allMatchingUsers.length,
          filteredCount,
        })
      }

      // Transform to match expected format
      const transformedPage = page.map((user: any) => ({
        _id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        displayUsername: user.displayUsername,
        capabilities: user.capabilities,
        adsDisabled: user.adsDisabled,
        interestedInHidingAds: user.interestedInHidingAds,
        createdAt: user.createdAt.getTime(),
        updatedAt: user.updatedAt.getTime(),
      }))

      return {
        page: transformedPage,
        isDone: !hasMore,
        counts: {
          total: filteredCount,
          filtered: filteredCount,
          pages: Math.max(1, Math.ceil(filteredCount / limit)),
        },
      }
    } else {
      // Standard SQL-based filtering (direct capabilities or no capability filters)
      // Get total count (with filters applied)
      const [totalCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause)

      const countTime = Date.now() - queryStartTime

      // Get filtered count (same as total when filters are applied)
      const filteredCount = Number(totalCount.count)

      // Apply SQL-level pagination (LIMIT/OFFSET)
      const offset = Math.max(0, pageIndex * limit)
      const selectStartTime = Date.now()
      const page = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(sql`${users.createdAt} DESC`)
        .limit(limit)
        .offset(offset)

      const selectTime = Date.now() - selectStartTime
      const totalTime = Date.now() - startTime

      const hasMore = offset + limit < filteredCount

      // Log performance metrics
      if (totalTime > 1000) {
        console.warn(`[listUsers] Slow query detected:`, {
          authTime: `${authTime}ms`,
          countTime: `${countTime}ms`,
          selectTime: `${selectTime}ms`,
          totalTime: `${totalTime}ms`,
          filters: {
            emailFilter: !!data.emailFilter,
            nameFilter: !!data.nameFilter,
            capabilityFilter: !!data.capabilityFilter,
            noCapabilitiesFilter: data.noCapabilitiesFilter,
            useEffectiveCapabilities: false,
          },
          pagination: { limit, pageIndex, offset },
          resultCount: page.length,
        })
      }

      // Transform to match expected format
      const transformedPage = page.map((user: any) => ({
        _id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        displayUsername: user.displayUsername,
        capabilities: user.capabilities,
        adsDisabled: user.adsDisabled,
        interestedInHidingAds: user.interestedInHidingAds,
        createdAt: user.createdAt.getTime(),
        updatedAt: user.updatedAt.getTime(),
      }))

      return {
        page: transformedPage,
        isDone: !hasMore,
        counts: {
          total: filteredCount,
          filtered: filteredCount,
          pages: Math.max(1, Math.ceil(filteredCount / limit)),
        },
      }
    }
  })

// Server function wrapper for updateAdPreference
export const updateAdPreference = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ adsDisabled: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    // Validate disableAds capability
    await requireCapability({ data: { capability: 'disableAds' } })

    await db
      .update(users)
      .set({ adsDisabled: data.adsDisabled, updatedAt: new Date() })
      .where(eq(users.id, user.userId))

    return { success: true }
  })

// Server function wrapper for setInterestedInHidingAds
export const setInterestedInHidingAds = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ interested: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    // Verify user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
    })

    if (!existingUser) {
      throw new Error('User not found')
    }

    await db
      .update(users)
      .set({
        interestedInHidingAds: data.interested,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.userId))

    return { success: true }
  })

// Server function wrapper for updateUserCapabilities (admin only)
export const updateUserCapabilities = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      capabilities: z.array(z.enum(['admin', 'disableAds', 'builder', 'feed'])),
    }),
  )
  .handler(async ({ data }) => {
    // Validate admin capability
    await requireCapability({ data: { capability: 'admin' } })

    // Validate that target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })

    if (!targetUser) {
      throw new Error('Target user not found')
    }

    const capabilities = data.capabilities

    await db
      .update(users)
      .set({ capabilities, updatedAt: new Date() })
      .where(eq(users.id, data.userId))

    return { success: true }
  })

// Server function wrapper for adminSetAdsDisabled (admin only)
export const adminSetAdsDisabled = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      adsDisabled: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    // Validate admin capability
    await requireCapability({ data: { capability: 'admin' } })

    // Validate that target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })

    if (!targetUser) {
      throw new Error('Target user not found')
    }

    await db
      .update(users)
      .set({ adsDisabled: data.adsDisabled, updatedAt: new Date() })
      .where(eq(users.id, data.userId))

    return { success: true }
  })

// Server function wrapper for bulkUpdateUserCapabilities (admin only)
export const bulkUpdateUserCapabilities = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userIds: z.array(z.string().uuid()),
      capabilities: z.array(z.enum(['admin', 'disableAds', 'builder', 'feed'])),
    }),
  )
  .handler(async ({ data }) => {
    // Validate admin capability
    await requireCapability({ data: { capability: 'admin' } })

    const validatedCapabilities = data.capabilities

    // Update all users
    await Promise.all(
      data.userIds.map(async (userId) => {
        const targetUser = await db.query.users.findFirst({
          where: eq(users.id, userId),
        })

        if (!targetUser) {
          throw new Error(`User ${userId} not found`)
        }

        const capabilities = validatedCapabilities

        await db
          .update(users)
          .set({ capabilities, updatedAt: new Date() })
          .where(eq(users.id, userId))
      }),
    )

    return { success: true, updated: data.userIds.length }
  })

// Revoke all sessions for a user by incrementing sessionVersion
// This invalidates all signed cookies for the user
export const revokeUserSessions = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: z.string(),
    }),
  )
  .handler(async ({ data: { userId } }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        sessionVersion: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    await db
      .update(users)
      .set({ sessionVersion: user.sessionVersion + 1, updatedAt: new Date() })
      .where(eq(users.id, userId))

    return { success: true }
  })
