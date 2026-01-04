import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { db } from '~/db/client'
import {
  showcases,
  users,
  auditLogs,
  SHOWCASE_USE_CASES,
  type ShowcaseStatus,
  type ShowcaseUseCase,
} from '~/db/schema'
import { eq, and, sql, desc, asc, inArray, arrayContains } from 'drizzle-orm'
import { getAuthenticatedUser } from './auth.server-helpers'
import {
  requireModerateShowcases,
  validateShowcaseOwnership,
  checkShowcaseRateLimit,
  expandLibraryDependencies,
  isValidUrl,
} from './showcase.server'
import { libraries } from '~/libraries'
import { getTrancoRank } from './tranco.server'
import { notifyAdmin, formatShowcaseSubmittedEmail } from './email.server'

// Valid library IDs for validation
const validLibraryIds = libraries.map((lib) => lib.id)

// Valibot schema for use cases
const useCaseSchema = v.picklist(SHOWCASE_USE_CASES as [string, ...string[]])

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
      useCases: v.optional(v.array(useCaseSchema), []),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser()

    if (!user) {
      throw new Error('Authentication required')
    }

    // Check rate limit
    const rateLimitExceeded = await checkShowcaseRateLimit(user.userId)
    if (rateLimitExceeded) {
      throw new Error(
        'Rate limit exceeded. Please wait before submitting more showcases.',
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

    notifyAdmin(
      formatShowcaseSubmittedEmail({
        name: data.name,
        url: data.url,
        tagline: data.tagline,
        libraries: expandedLibraries,
        userName: userRecord[0]?.name || undefined,
      }),
    )

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
      useCases: v.optional(v.array(useCaseSchema), []),
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
          useCases: v.optional(v.array(useCaseSchema)),
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
          status: v.optional(
            v.array(v.picklist(['pending', 'approved', 'denied'])),
          ),
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
