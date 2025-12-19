import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '~/db/client'
import {
  docFeedback,
  users,
  type DocFeedbackType,
  type DocFeedbackStatus,
} from '~/db/schema'
import { eq, and, sql, desc, gte, inArray } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import {
  calculatePoints,
  requireModerateFeedback,
  getUserFeedbackStats,
  validateFeedbackOwnership,
  canModerateFeedback,
  checkRateLimit,
} from './docFeedback.server'

/**
 * Create new doc feedback
 */
export const createDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('note'),
        content: z.string().min(1, 'Note cannot be empty'),
        pagePath: z.string(),
        libraryId: z.string(),
        libraryVersion: z.string(),
        blockSelector: z.string(),
        blockContentHash: z.string().optional(),
      }),
      z.object({
        type: z.literal('improvement'),
        content: z
          .string()
          .min(10, 'Improvement feedback must be at least 10 characters'),
        pagePath: z.string(),
        libraryId: z.string(),
        libraryVersion: z.string(),
        blockSelector: z.string(),
        blockContentHash: z.string().optional(),
      }),
    ]),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Check rate limit
    const rateLimitExceeded = await checkRateLimit(user.userId)
    if (rateLimitExceeded) {
      throw new Error(
        'Rate limit exceeded. Please wait before submitting more feedback.',
      )
    }

    // Store character count, calculate points for response
    const characterCount = data.content.length
    const points = calculatePoints(characterCount, data.type)

    // Create feedback
    const [newFeedback] = await db
      .insert(docFeedback)
      .values({
        userId: user.userId,
        type: data.type as DocFeedbackType,
        content: data.content,
        pagePath: data.pagePath,
        libraryId: data.libraryId,
        libraryVersion: data.libraryVersion,
        blockSelector: data.blockSelector,
        blockContentHash: data.blockContentHash,
        characterCount,
        status: 'pending' as DocFeedbackStatus,
      })
      .returning()

    return {
      success: true,
      feedbackId: newFeedback.id,
      points,
    }
  })

/**
 * Update existing doc feedback (user can edit their own)
 */
export const updateDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      feedbackId: z.string().uuid(),
      content: z.string().min(1, 'Content cannot be empty'),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Validate ownership
    await validateFeedbackOwnership(data.feedbackId, user.userId)

    // Get existing feedback to check type
    const existing = await db
      .select()
      .from(docFeedback)
      .where(eq(docFeedback.id, data.feedbackId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Feedback not found')
    }

    // Validate minimum length for improvements
    if (existing[0].type === 'improvement' && data.content.length < 10) {
      throw new Error('Improvement feedback must be at least 10 characters')
    }

    // Store character count, calculate points for response
    const characterCount = data.content.length
    const points = calculatePoints(characterCount, existing[0].type)

    // Update feedback
    await db
      .update(docFeedback)
      .set({
        content: data.content,
        characterCount,
        updatedAt: new Date(),
      })
      .where(eq(docFeedback.id, data.feedbackId))

    return { success: true, points }
  })

/**
 * Delete doc feedback (user can delete their own)
 */
export const deleteDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ feedbackId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Validate ownership
    await validateFeedbackOwnership(data.feedbackId, user.userId)

    // Delete feedback
    await db.delete(docFeedback).where(eq(docFeedback.id, data.feedbackId))

    return { success: true }
  })

/**
 * Update doc feedback collapsed state
 */
export const updateDocFeedbackCollapsed = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      feedbackId: z.string().uuid(),
      isCollapsed: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Validate ownership
    await validateFeedbackOwnership(data.feedbackId, user.userId)

    // Update collapsed state
    await db
      .update(docFeedback)
      .set({
        isCollapsed: data.isCollapsed,
        updatedAt: new Date(),
      })
      .where(eq(docFeedback.id, data.feedbackId))

    return { success: true }
  })

/**
 * Get user's own feedback with status and points
 */
export const getUserDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      pagination: z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
      filters: z
        .object({
          status: z.array(z.enum(['pending', 'approved', 'denied'])).optional(),
          libraryId: z.string().optional(),
          type: z.array(z.enum(['note', 'improvement'])).optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    const { page, pageSize } = data.pagination
    const filters = data.filters ?? {}

    // Build where conditions
    const conditions = [eq(docFeedback.userId, user.userId)]

    if (filters.status && filters.status.length > 0) {
      conditions.push(
        inArray(docFeedback.status, filters.status as DocFeedbackStatus[]),
      )
    }

    if (filters.libraryId) {
      conditions.push(eq(docFeedback.libraryId, filters.libraryId))
    }

    if (filters.type && filters.type.length > 0) {
      conditions.push(
        inArray(docFeedback.type, filters.type as DocFeedbackType[]),
      )
    }

    const whereClause = and(...conditions)

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(docFeedback)
      .where(whereClause)

    const total = countResult?.count ?? 0

    // Get paginated results
    const offset = (page - 1) * pageSize
    const feedbackList = await db
      .select()
      .from(docFeedback)
      .where(whereClause)
      .orderBy(desc(docFeedback.createdAt))
      .limit(pageSize)
      .offset(offset)

    // Get user stats
    const stats = await getUserFeedbackStats(user.userId)

    return {
      feedback: feedbackList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats,
    }
  })

/**
 * List all feedback for moderation (moderate-feedback capability required)
 */
export const listDocFeedbackForModeration = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      pagination: z.object({
        page: z.number().default(1),
        pageSize: z.number().default(50),
      }),
      filters: z
        .object({
          status: z.array(z.enum(['pending', 'approved', 'denied'])).optional(),
          type: z.array(z.enum(['note', 'improvement'])).optional(),
          libraryId: z.string().optional(),
          isDetached: z.boolean().optional(),
          userId: z.string().uuid().optional(),
          dateFrom: z.string().optional(), // ISO date string
          dateTo: z.string().optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireModerateFeedback()

    const { page, pageSize } = data.pagination
    const filters = data.filters ?? {}

    // Build where conditions
    const conditions = []

    if (filters.status && filters.status.length > 0) {
      conditions.push(
        inArray(docFeedback.status, filters.status as DocFeedbackStatus[]),
      )
    }

    if (filters.type && filters.type.length > 0) {
      conditions.push(
        inArray(docFeedback.type, filters.type as DocFeedbackType[]),
      )
    }

    if (filters.libraryId) {
      conditions.push(eq(docFeedback.libraryId, filters.libraryId))
    }

    if (filters.isDetached !== undefined) {
      conditions.push(eq(docFeedback.isDetached, filters.isDetached))
    }

    if (filters.userId) {
      conditions.push(eq(docFeedback.userId, filters.userId))
    }

    if (filters.dateFrom) {
      conditions.push(gte(docFeedback.createdAt, new Date(filters.dateFrom)))
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo)
      dateTo.setHours(23, 59, 59, 999)
      conditions.push(sql`${docFeedback.createdAt} <= ${dateTo}`)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(docFeedback)
      .where(whereClause)

    const total = countResult?.count ?? 0

    // Get paginated results with user info
    const offset = (page - 1) * pageSize
    const feedbackList = await db
      .select({
        feedback: docFeedback,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(docFeedback)
      .leftJoin(users, eq(docFeedback.userId, users.id))
      .where(whereClause)
      .orderBy(desc(docFeedback.createdAt))
      .limit(pageSize)
      .offset(offset)

    return {
      feedback: feedbackList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

/**
 * Moderate feedback (approve or deny)
 */
export const moderateDocFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      feedbackId: z.string().uuid(),
      action: z.enum(['approve', 'deny']),
      moderationNote: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const moderator = await requireModerateFeedback()

    const status: DocFeedbackStatus =
      data.action === 'approve' ? 'approved' : 'denied'

    await db
      .update(docFeedback)
      .set({
        status,
        moderatedBy: moderator.userId,
        moderatedAt: new Date(),
        moderationNote: data.moderationNote,
        updatedAt: new Date(),
      })
      .where(eq(docFeedback.id, data.feedbackId))

    return { success: true }
  })

/**
 * Get feedback leaderboard (public) - all-time
 */
export const getDocFeedbackLeaderboard = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      pagination: z.object({
        page: z.number().default(1),
        pageSize: z.number().default(50),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const { page, pageSize } = data.pagination

    // Get all approved feedback to calculate leaderboard in JS
    const allFeedback = await db
      .select({
        userId: docFeedback.userId,
        characterCount: docFeedback.characterCount,
        type: docFeedback.type,
        userName: users.name,
      })
      .from(docFeedback)
      .leftJoin(users, eq(docFeedback.userId, users.id))
      .where(eq(docFeedback.status, 'approved' as DocFeedbackStatus))

    // Calculate points and aggregate by user in JS
    const userStats = new Map<
      string,
      {
        userId: string
        firstName: string | null
        lastInitial: string | null
        totalPoints: number
        feedbackCount: number
      }
    >()

    allFeedback.forEach((item) => {
      const points = calculatePoints(item.characterCount, item.type)
      const existing = userStats.get(item.userId)

      if (existing) {
        existing.totalPoints += points
        existing.feedbackCount++
      } else {
        // Parse name
        const nameParts = item.userName?.split(' ') || []
        const firstName = nameParts[0] || null
        const lastInitial = nameParts[1]?.[0] || null

        userStats.set(item.userId, {
          userId: item.userId,
          firstName,
          lastInitial,
          totalPoints: points,
          feedbackCount: 1,
        })
      }
    })

    // Sort by total points and paginate
    const sortedLeaderboard = Array.from(userStats.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    )

    const offset = (page - 1) * pageSize
    const leaderboard = sortedLeaderboard.slice(offset, offset + pageSize)

    const total = userStats.size

    return {
      leaderboard,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

/**
 * Get feedback for a specific doc page (for displaying on the page)
 */
export const getDocFeedbackForPage = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      pagePath: z.string(),
      libraryVersion: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    // Try to get user, but don't require authentication
    let user
    try {
      user = await getAuthenticatedUser()
    } catch {
      // User not authenticated, that's okay
    }

    // Get user's own feedback for this page (all statuses)
    let userFeedback: any[] = []
    if (user) {
      userFeedback = await db
        .select()
        .from(docFeedback)
        .where(
          and(
            eq(docFeedback.userId, user.userId),
            eq(docFeedback.pagePath, data.pagePath),
            eq(docFeedback.libraryVersion, data.libraryVersion),
          ),
        )
        .orderBy(desc(docFeedback.createdAt))
    }

    // Check if user can moderate
    const isModerator = user ? await canModerateFeedback(user.userId) : false

    // If moderator, also get detached feedback for this page
    let detachedFeedback: any[] = []
    if (isModerator) {
      detachedFeedback = await db
        .select()
        .from(docFeedback)
        .where(
          and(
            eq(docFeedback.pagePath, data.pagePath),
            eq(docFeedback.isDetached, true),
          ),
        )
        .orderBy(desc(docFeedback.createdAt))
        .limit(10)
    }

    return {
      userFeedback,
      detachedFeedback,
      isModerator,
    }
  })

/**
 * Mark feedback as detached (when block no longer exists)
 */
export const markFeedbackDetached = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      feedbackIds: z.array(z.string().uuid()),
    }),
  )
  .handler(async ({ data }) => {
    await requireModerateFeedback()

    await db
      .update(docFeedback)
      .set({
        isDetached: true,
        updatedAt: new Date(),
      })
      .where(inArray(docFeedback.id, data.feedbackIds))

    return { success: true }
  })
