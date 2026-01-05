import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { db } from '~/db/client'
import {
  showcases,
  showcaseVotes,
  users,
  auditLogs,
  type ShowcaseStatus,
  type ShowcaseUseCase,
} from '~/db/schema'
import { eq, and, sql, desc, asc, inArray, arrayContains } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import {
  requireModerateShowcases,
  validateShowcaseOwnership,
  checkPendingSubmissionLimit,
  expandLibraryDependencies,
  isValidUrl,
} from './showcase.server'
import { libraries } from '~/libraries'
import { getTrancoRank } from './tranco.server'
import { notifyModerators, formatShowcaseSubmittedEmail } from './email.server'
import { showcaseUseCaseSchema, showcaseStatusSchema } from './schemas'

// Valid library IDs for validation
const validLibraryIds = libraries.map((lib) => lib.id)

/**
 * Submit a new showcase
 */
export const submitShowcase = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      name: v.pipe(
        v.string(),
        v.minLength(1, 'Name is required'),
        v.maxLength(255),
      ),
      tagline: v.pipe(
        v.string(),
        v.minLength(1, 'Tagline is required'),
        v.maxLength(500),
      ),
      description: v.optional(v.string()),
      url: v.pipe(v.string(), v.minLength(1, 'URL is required')),
      logoUrl: v.optional(v.string()),
      screenshotUrl: v.pipe(
        v.string(),
        v.minLength(1, 'Screenshot URL is required'),
      ),
      libraries: v.pipe(
        v.array(v.string()),
        v.minLength(1, 'At least one library is required'),
      ),
      useCases: v.optional(v.array(showcaseUseCaseSchema), []),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Check pending submission limit
    const limitReached = await checkPendingSubmissionLimit(user.userId)
    if (limitReached) {
      throw new Error(
        'You have reached the limit of 5 pending submissions. Please wait for existing submissions to be reviewed.',
      )
    }

    // Validate URL format
    if (!isValidUrl(data.url)) {
      throw new Error('Invalid URL format')
    }

    if (data.logoUrl && !isValidUrl(data.logoUrl)) {
      throw new Error('Invalid logo URL format')
    }

    if (!isValidUrl(data.screenshotUrl)) {
      throw new Error('Invalid screenshot URL format')
    }

    // Validate library IDs
    const invalidLibraries = data.libraries.filter(
      (lib) => !validLibraryIds.includes(lib as any),
    )
    if (invalidLibraries.length > 0) {
      throw new Error(`Invalid library IDs: ${invalidLibraries.join(', ')}`)
    }

    // Expand library dependencies (e.g., Start includes Router)
    const expandedLibraries = expandLibraryDependencies(data.libraries)

    // Fetch Tranco rank for popularity sorting
    const trancoRank = await getTrancoRank(data.url)

    // Create showcase
    const [newShowcase] = await db
      .insert(showcases)
      .values({
        userId: user.userId,
        name: data.name,
        tagline: data.tagline,
        description: data.description,
        url: data.url,
        logoUrl: data.logoUrl,
        screenshotUrl: data.screenshotUrl,
        libraries: expandedLibraries,
        useCases: data.useCases as ShowcaseUseCase[],
        status: 'pending',
        trancoRank,
        trancoRankUpdatedAt: trancoRank ? new Date() : null,
      })
      .returning()

    // Log the creation
    await db.insert(auditLogs).values({
      actorId: user.userId,
      action: 'showcase.create',
      targetType: 'showcase',
      targetId: newShowcase.id,
      details: {
        name: data.name,
        url: data.url,
        libraries: expandedLibraries,
      },
    })

    // Notify admin of new submission
    const userRecord = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1)

    notifyModerators({
      capability: 'moderate-showcases',
      ...formatShowcaseSubmittedEmail({
        name: data.name,
        url: data.url,
        tagline: data.tagline,
        libraries: expandedLibraries,
        userName: userRecord[0]?.name || undefined,
      }),
    })

    return {
      success: true,
      showcaseId: newShowcase.id,
    }
  })

/**
 * Update an existing showcase (resets to pending)
 */
export const updateShowcase = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      showcaseId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(
        v.string(),
        v.minLength(1, 'Name is required'),
        v.maxLength(255),
      ),
      tagline: v.pipe(
        v.string(),
        v.minLength(1, 'Tagline is required'),
        v.maxLength(500),
      ),
      description: v.optional(v.string()),
      url: v.pipe(v.string(), v.minLength(1, 'URL is required')),
      logoUrl: v.optional(v.string()),
      screenshotUrl: v.pipe(
        v.string(),
        v.minLength(1, 'Screenshot URL is required'),
      ),
      libraries: v.pipe(
        v.array(v.string()),
        v.minLength(1, 'At least one library is required'),
      ),
      useCases: v.optional(v.array(showcaseUseCaseSchema), []),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Validate ownership
    await validateShowcaseOwnership(data.showcaseId, user.userId)

    // Validate URL format
    if (!isValidUrl(data.url)) {
      throw new Error('Invalid URL format')
    }

    if (data.logoUrl && !isValidUrl(data.logoUrl)) {
      throw new Error('Invalid logo URL format')
    }

    if (!isValidUrl(data.screenshotUrl)) {
      throw new Error('Invalid screenshot URL format')
    }

    // Validate library IDs
    const invalidLibraries = data.libraries.filter(
      (lib) => !validLibraryIds.includes(lib as any),
    )
    if (invalidLibraries.length > 0) {
      throw new Error(`Invalid library IDs: ${invalidLibraries.join(', ')}`)
    }

    // Expand library dependencies
    const expandedLibraries = expandLibraryDependencies(data.libraries)

    // Get existing showcase for audit log and URL comparison
    const existing = await db
      .select()
      .from(showcases)
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    // Re-fetch Tranco rank if URL changed
    const urlChanged = existing[0]?.url !== data.url
    const trancoRank = urlChanged
      ? await getTrancoRank(data.url)
      : existing[0]?.trancoRank

    // Update showcase - edits reset to pending
    await db
      .update(showcases)
      .set({
        name: data.name,
        tagline: data.tagline,
        description: data.description,
        url: data.url,
        logoUrl: data.logoUrl,
        screenshotUrl: data.screenshotUrl,
        libraries: expandedLibraries,
        useCases: data.useCases as ShowcaseUseCase[],
        status: 'pending',
        moderatedBy: null,
        moderatedAt: null,
        moderationNote: null,
        updatedAt: new Date(),
        ...(urlChanged && {
          trancoRank,
          trancoRankUpdatedAt: trancoRank ? new Date() : null,
        }),
      })
      .where(eq(showcases.id, data.showcaseId))

    // Log the update
    await db.insert(auditLogs).values({
      actorId: user.userId,
      action: 'showcase.update',
      targetType: 'showcase',
      targetId: data.showcaseId,
      details: {
        before: existing[0],
        after: {
          name: data.name,
          url: data.url,
          libraries: expandedLibraries,
        },
      },
    })

    return { success: true }
  })

/**
 * Delete a showcase
 */
export const deleteShowcase = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ showcaseId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Validate ownership
    await validateShowcaseOwnership(data.showcaseId, user.userId)

    // Get existing for audit log
    const existing = await db
      .select()
      .from(showcases)
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    // Delete showcase
    await db.delete(showcases).where(eq(showcases.id, data.showcaseId))

    // Log the deletion
    await db.insert(auditLogs).values({
      actorId: user.userId,
      action: 'showcase.delete',
      targetType: 'showcase',
      targetId: data.showcaseId,
      details: { deleted: existing[0] },
    })

    return { success: true }
  })

/**
 * Get user's own showcases
 */
export const getMyShowcases = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      pagination: v.object({
        page: v.optional(v.number(), 1),
        pageSize: v.optional(v.number(), 20),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    const { page, pageSize } = data.pagination

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(showcases)
      .where(eq(showcases.userId, user.userId))

    const total = countResult?.count ?? 0

    // Get paginated results
    const offset = (page - 1) * pageSize
    const showcaseList = await db
      .select()
      .from(showcases)
      .where(eq(showcases.userId, user.userId))
      .orderBy(desc(showcases.createdAt))
      .limit(pageSize)
      .offset(offset)

    return {
      showcases: showcaseList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

/**
 * Get approved showcases (public)
 */
export const getApprovedShowcases = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      pagination: v.object({
        page: v.optional(v.number(), 1),
        pageSize: v.optional(v.number(), 24),
      }),
      filters: v.optional(
        v.object({
          libraryId: v.optional(v.string()),
          useCases: v.optional(v.array(showcaseUseCaseSchema)),
          featured: v.optional(v.boolean()),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const { page, pageSize } = data.pagination
    const filters = data.filters ?? {}

    // Build where conditions
    const conditions = [eq(showcases.status, 'approved' as ShowcaseStatus)]

    if (filters.libraryId) {
      conditions.push(arrayContains(showcases.libraries, [filters.libraryId]))
    }

    if (filters.useCases && filters.useCases.length > 0) {
      // Match any of the selected use cases using array overlap operator
      // Need to cast the array properly for PostgreSQL
      conditions.push(
        sql`${showcases.useCases} && ARRAY[${sql.join(
          filters.useCases.map((uc) => sql`${uc}`),
          sql`, `,
        )}]::showcase_use_case[]`,
      )
    }

    if (filters.featured !== undefined) {
      conditions.push(eq(showcases.isFeatured, filters.featured))
    }

    const whereClause = and(...conditions)

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(showcases)
      .where(whereClause)

    const total = countResult?.count ?? 0

    // Get paginated results with user info
    const offset = (page - 1) * pageSize
    const showcaseList = await db
      .select({
        showcase: showcases,
        user: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(showcases)
      .leftJoin(users, eq(showcases.userId, users.id))
      .where(whereClause)
      .orderBy(
        desc(showcases.isFeatured),
        desc(showcases.voteScore),
        sql`${showcases.trancoRank} ASC NULLS LAST`,
        desc(showcases.createdAt),
      )
      .limit(pageSize)
      .offset(offset)

    return {
      showcases: showcaseList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

/**
 * Get showcases by library (public)
 */
export const getShowcasesByLibrary = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      libraryId: v.string(),
      limit: v.optional(v.number(), 6),
    }),
  )
  .handler(async ({ data }) => {
    const showcaseList = await db
      .select({
        showcase: showcases,
        user: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(showcases)
      .leftJoin(users, eq(showcases.userId, users.id))
      .where(
        and(
          eq(showcases.status, 'approved' as ShowcaseStatus),
          arrayContains(showcases.libraries, [data.libraryId]),
        ),
      )
      .orderBy(
        desc(showcases.isFeatured),
        desc(showcases.voteScore),
        sql`${showcases.trancoRank} ASC NULLS LAST`,
        desc(showcases.createdAt),
      )
      .limit(data.limit)

    return { showcases: showcaseList }
  })

/**
 * Get featured showcases (public, for homepage)
 * Shows featured first, then by popularity (Tranco rank), then by date
 */
export const getFeaturedShowcases = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      limit: v.optional(v.number(), 6),
    }),
  )
  .handler(async ({ data }) => {
    // Get approved showcases, prioritizing featured ones, then by popularity
    const showcaseList = await db
      .select({
        showcase: showcases,
        user: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(showcases)
      .leftJoin(users, eq(showcases.userId, users.id))
      .where(eq(showcases.status, 'approved' as ShowcaseStatus))
      .orderBy(
        desc(showcases.isFeatured),
        desc(showcases.voteScore),
        sql`${showcases.trancoRank} ASC NULLS LAST`,
        desc(showcases.createdAt),
      )
      .limit(data.limit)

    return { showcases: showcaseList }
  })

/**
 * List showcases for moderation (moderate-showcases capability required)
 */
export const listShowcasesForModeration = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      pagination: v.object({
        page: v.optional(v.number(), 1),
        pageSize: v.optional(v.number(), 50),
      }),
      filters: v.optional(
        v.object({
          status: v.optional(v.array(showcaseStatusSchema)),
          libraryId: v.optional(v.string()),
          userId: v.optional(v.pipe(v.string(), v.uuid())),
          isFeatured: v.optional(v.boolean()),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    await requireModerateShowcases()

    const { page, pageSize } = data.pagination
    const filters = data.filters ?? {}

    // Build where conditions
    const conditions = []

    if (filters.status && filters.status.length > 0) {
      conditions.push(
        inArray(showcases.status, filters.status as ShowcaseStatus[]),
      )
    }

    if (filters.libraryId) {
      conditions.push(arrayContains(showcases.libraries, [filters.libraryId]))
    }

    if (filters.userId) {
      conditions.push(eq(showcases.userId, filters.userId))
    }

    if (filters.isFeatured !== undefined) {
      conditions.push(eq(showcases.isFeatured, filters.isFeatured))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(showcases)
      .where(whereClause)

    const total = countResult?.count ?? 0

    // Get paginated results with user info
    const offset = (page - 1) * pageSize
    const showcaseList = await db
      .select({
        showcase: showcases,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(showcases)
      .leftJoin(users, eq(showcases.userId, users.id))
      .where(whereClause)
      .orderBy(
        sql`CASE ${showcases.status} WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'denied' THEN 2 END`,
        desc(showcases.createdAt),
      )
      .limit(pageSize)
      .offset(offset)

    return {
      showcases: showcaseList,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

/**
 * Moderate a showcase (approve or deny)
 */
export const moderateShowcase = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      showcaseId: v.pipe(v.string(), v.uuid()),
      action: v.picklist(['approve', 'deny']),
      moderationNote: v.optional(v.string()),
    }),
  )
  .handler(async ({ data }) => {
    const moderator = await requireModerateShowcases()

    // Get existing for audit log
    const existing = await db
      .select()
      .from(showcases)
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Showcase not found')
    }

    const status: ShowcaseStatus =
      data.action === 'approve' ? 'approved' : 'denied'

    await db
      .update(showcases)
      .set({
        status,
        moderatedBy: moderator.userId,
        moderatedAt: new Date(),
        moderationNote: data.moderationNote,
        updatedAt: new Date(),
      })
      .where(eq(showcases.id, data.showcaseId))

    // Log the moderation
    await db.insert(auditLogs).values({
      actorId: moderator.userId,
      action: 'showcase.moderate',
      targetType: 'showcase',
      targetId: data.showcaseId,
      details: {
        action: data.action,
        moderationNote: data.moderationNote,
        before: { status: existing[0].status },
        after: { status },
      },
    })

    return { success: true }
  })

/**
 * Set featured status for a showcase
 */
export const setShowcaseFeatured = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      showcaseId: v.pipe(v.string(), v.uuid()),
      isFeatured: v.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const moderator = await requireModerateShowcases()

    // Get existing for audit log
    const existing = await db
      .select()
      .from(showcases)
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Showcase not found')
    }

    await db
      .update(showcases)
      .set({
        isFeatured: data.isFeatured,
        updatedAt: new Date(),
      })
      .where(eq(showcases.id, data.showcaseId))

    // Log the change
    await db.insert(auditLogs).values({
      actorId: moderator.userId,
      action: 'showcase.moderate',
      targetType: 'showcase',
      targetId: data.showcaseId,
      details: {
        action: 'set_featured',
        before: { isFeatured: existing[0].isFeatured },
        after: { isFeatured: data.isFeatured },
      },
    })

    return { success: true }
  })

/**
 * Get a single showcase by ID (public for approved, owner for any status)
 */
export const getShowcase = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ showcaseId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data }) => {
    let user
    try {
      user = await getAuthenticatedUser()
    } catch {
      // User not authenticated, that's okay for approved showcases
    }

    const [result] = await db
      .select({
        showcase: showcases,
        user: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(showcases)
      .leftJoin(users, eq(showcases.userId, users.id))
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    if (!result) {
      throw new Error('Showcase not found')
    }

    // Check access: public if approved, or owner can see their own
    if (
      result.showcase.status !== 'approved' &&
      result.showcase.userId !== user?.userId
    ) {
      throw new Error('Showcase not found')
    }

    return { showcase: result.showcase, user: result.user }
  })

/**
 * Get a single showcase by ID for admin (moderate-showcases capability required)
 */
export const adminGetShowcase = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ showcaseId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data }) => {
    await requireModerateShowcases()

    const [result] = await db
      .select({
        showcase: showcases,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(showcases)
      .leftJoin(users, eq(showcases.userId, users.id))
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    if (!result) {
      return null
    }

    return { showcase: result.showcase, user: result.user }
  })

/**
 * Admin delete a showcase (moderate-showcases capability required)
 */
export const adminDeleteShowcase = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ showcaseId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data }) => {
    const moderator = await requireModerateShowcases()

    // Get existing for audit log
    const existing = await db
      .select()
      .from(showcases)
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Showcase not found')
    }

    // Delete showcase
    await db.delete(showcases).where(eq(showcases.id, data.showcaseId))

    // Log the deletion
    await db.insert(auditLogs).values({
      actorId: moderator.userId,
      action: 'showcase.delete',
      targetType: 'showcase',
      targetId: data.showcaseId,
      details: { deleted: existing[0], deletedBy: 'moderator' },
    })

    return { success: true }
  })

/**
 * Vote on a showcase (upvote or downvote)
 * If user already voted with the same value, removes the vote (toggle off)
 * If user voted with different value, updates to new value
 */
export const voteShowcase = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      showcaseId: v.pipe(v.string(), v.uuid()),
      value: v.picklist([1, -1]),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Check showcase exists and is approved
    const [showcase] = await db
      .select({ id: showcases.id, status: showcases.status })
      .from(showcases)
      .where(eq(showcases.id, data.showcaseId))
      .limit(1)

    if (!showcase) {
      throw new Error('Showcase not found')
    }

    if (showcase.status !== 'approved') {
      throw new Error('Can only vote on approved showcases')
    }

    // Check for existing vote
    const [existingVote] = await db
      .select()
      .from(showcaseVotes)
      .where(
        and(
          eq(showcaseVotes.showcaseId, data.showcaseId),
          eq(showcaseVotes.userId, user.userId),
        ),
      )
      .limit(1)

    if (existingVote) {
      if (existingVote.value === data.value) {
        // Same vote, toggle off (remove)
        await db
          .delete(showcaseVotes)
          .where(eq(showcaseVotes.id, existingVote.id))
      } else {
        // Different vote, update
        await db
          .update(showcaseVotes)
          .set({ value: data.value, updatedAt: new Date() })
          .where(eq(showcaseVotes.id, existingVote.id))
      }
    } else {
      // No existing vote, insert new one
      await db.insert(showcaseVotes).values({
        showcaseId: data.showcaseId,
        userId: user.userId,
        value: data.value,
      })
    }

    // Recalculate and update voteScore
    const [scoreResult] = await db
      .select({
        score: sql<number>`COALESCE(SUM(${showcaseVotes.value}), 0)::int`,
      })
      .from(showcaseVotes)
      .where(eq(showcaseVotes.showcaseId, data.showcaseId))

    await db
      .update(showcases)
      .set({ voteScore: scoreResult?.score ?? 0 })
      .where(eq(showcases.id, data.showcaseId))

    return { success: true, voteScore: scoreResult?.score ?? 0 }
  })

/**
 * Get current user's votes for a batch of showcases
 */
export const getMyShowcaseVotes = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      showcaseIds: v.array(v.pipe(v.string(), v.uuid())),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      return { votes: [] }
    }

    if (data.showcaseIds.length === 0) {
      return { votes: [] }
    }

    const votes = await db
      .select({
        showcaseId: showcaseVotes.showcaseId,
        value: showcaseVotes.value,
      })
      .from(showcaseVotes)
      .where(
        and(
          eq(showcaseVotes.userId, user.userId),
          inArray(showcaseVotes.showcaseId, data.showcaseIds),
        ),
      )

    return { votes }
  })
