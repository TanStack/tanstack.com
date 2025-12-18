import { createServerFn } from '@tanstack/react-start'
import { db } from '~/db/client'
import { banners, bannerDismissals } from '~/db/schema'
import { eq, and, gte, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { loadUser } from './auth.server'
import { requireAdmin } from './feed.server'
import type { BannerScope, BannerStyle } from '~/db/schema'

export type ActiveBanner = {
  id: string
  title: string
  content: string | null
  linkUrl: string | null
  linkText: string | null
  style: BannerStyle
  scope: BannerScope
  pathPrefixes: string[]
  priority: number
  startsAt: number | null
  expiresAt: number | null
}

export type BannerWithMeta = ActiveBanner & {
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// Server function to get active banners for a given path
export const getActiveBanners = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      pathname: z.string(),
    }),
  )
  .handler(async ({ data }): Promise<ActiveBanner[]> => {
    const now = new Date()

    // Get all active banners that are within their schedule
    const activeBanners = await db.query.banners.findMany({
      where: and(
        eq(banners.isActive, true),
        // Either no start date or starts_at <= now
        or(sql`${banners.startsAt} IS NULL`, lte(banners.startsAt, now)),
        // Either no end date or expires_at >= now
        or(sql`${banners.expiresAt} IS NULL`, gte(banners.expiresAt, now)),
      ),
      orderBy: (b, { desc }) => [desc(b.priority), desc(b.createdAt)],
    })

    // Filter banners based on scope and current path
    const filteredBanners = activeBanners.filter((banner) => {
      if (banner.scope === 'global') {
        return true
      }

      // For targeted banners, check if pathname matches any path prefix
      if (banner.scope === 'targeted') {
        return banner.pathPrefixes.some((prefix) =>
          data.pathname.startsWith(prefix),
        )
      }

      return false
    })

    return filteredBanners.map((banner) => ({
      id: banner.id,
      title: banner.title,
      content: banner.content,
      linkUrl: banner.linkUrl,
      linkText: banner.linkText,
      style: banner.style,
      scope: banner.scope,
      pathPrefixes: banner.pathPrefixes,
      priority: banner.priority,
      startsAt: banner.startsAt?.getTime() ?? null,
      expiresAt: banner.expiresAt?.getTime() ?? null,
    }))
  })

// Server function to get dismissed banner IDs for the current user
export const getDismissedBannerIds = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const user = await loadUser()

    if (!user) {
      return []
    }

    const dismissals = await db.query.bannerDismissals.findMany({
      where: eq(bannerDismissals.userId, user.userId),
      columns: {
        bannerId: true,
      },
    })

    return dismissals.map((d) => d.bannerId)
  },
)

// Server function to dismiss a banner for the current user
export const dismissBanner = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      bannerId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const user = await loadUser()

    if (!user) {
      // For anonymous users, we can't store in DB - client will use localStorage
      return { success: false }
    }

    // Check if already dismissed
    const existing = await db.query.bannerDismissals.findFirst({
      where: and(
        eq(bannerDismissals.userId, user.userId),
        eq(bannerDismissals.bannerId, data.bannerId),
      ),
    })

    if (existing) {
      return { success: true }
    }

    // Create dismissal record
    await db.insert(bannerDismissals).values({
      userId: user.userId,
      bannerId: data.bannerId,
    })

    return { success: true }
  })

// ============================================
// Admin CRUD Operations
// ============================================

// List all banners (admin)
export const listBanners = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      includeInactive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<BannerWithMeta[]> => {
    await requireAdmin()

    const whereClause = data.includeInactive
      ? undefined
      : eq(banners.isActive, true)

    const allBanners = await db.query.banners.findMany({
      where: whereClause,
      orderBy: (b, { desc }) => [desc(b.priority), desc(b.createdAt)],
    })

    return allBanners.map((banner) => ({
      id: banner.id,
      title: banner.title,
      content: banner.content,
      linkUrl: banner.linkUrl,
      linkText: banner.linkText,
      style: banner.style,
      scope: banner.scope,
      pathPrefixes: banner.pathPrefixes,
      priority: banner.priority,
      isActive: banner.isActive,
      startsAt: banner.startsAt?.getTime() ?? null,
      expiresAt: banner.expiresAt?.getTime() ?? null,
      createdAt: banner.createdAt.getTime(),
      updatedAt: banner.updatedAt.getTime(),
    }))
  })

// Get single banner by ID (admin)
export const getBanner = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<BannerWithMeta | null> => {
    await requireAdmin()

    const banner = await db.query.banners.findFirst({
      where: eq(banners.id, data.id),
    })

    if (!banner) {
      return null
    }

    return {
      id: banner.id,
      title: banner.title,
      content: banner.content,
      linkUrl: banner.linkUrl,
      linkText: banner.linkText,
      style: banner.style,
      scope: banner.scope,
      pathPrefixes: banner.pathPrefixes,
      priority: banner.priority,
      isActive: banner.isActive,
      startsAt: banner.startsAt?.getTime() ?? null,
      expiresAt: banner.expiresAt?.getTime() ?? null,
      createdAt: banner.createdAt.getTime(),
      updatedAt: banner.updatedAt.getTime(),
    }
  })

// Create new banner (admin)
export const createBanner = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      title: z.string().min(1, 'Title is required'),
      content: z.string().optional(),
      linkUrl: z.string().url().optional().or(z.literal('')),
      linkText: z.string().optional(),
      style: z.enum(['info', 'warning', 'success', 'promo']).default('info'),
      scope: z.enum(['global', 'targeted']).default('global'),
      pathPrefixes: z.array(z.string()).default([]),
      isActive: z.boolean().default(true),
      startsAt: z.number().optional(),
      expiresAt: z.number().optional(),
      priority: z.number().default(0),
    }),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    await requireAdmin()

    const [newBanner] = await db
      .insert(banners)
      .values({
        title: data.title,
        content: data.content || null,
        linkUrl: data.linkUrl || null,
        linkText: data.linkText || null,
        style: data.style,
        scope: data.scope,
        pathPrefixes: data.pathPrefixes,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        priority: data.priority,
      })
      .returning()

    return { id: newBanner.id }
  })

// Update banner (admin)
export const updateBanner = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      linkUrl: z.string().url().optional().or(z.literal('')),
      linkText: z.string().optional(),
      style: z.enum(['info', 'warning', 'success', 'promo']).optional(),
      scope: z.enum(['global', 'targeted']).optional(),
      pathPrefixes: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      startsAt: z.number().nullable().optional(),
      expiresAt: z.number().nullable().optional(),
      priority: z.number().optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()

    const existing = await db.query.banners.findFirst({
      where: eq(banners.id, data.id),
    })

    if (!existing) {
      throw new Error('Banner not found')
    }

    const updates: {
      title?: string
      content?: string | null
      linkUrl?: string | null
      linkText?: string | null
      style?: BannerStyle
      scope?: BannerScope
      pathPrefixes?: string[]
      isActive?: boolean
      startsAt?: Date | null
      expiresAt?: Date | null
      priority?: number
      updatedAt: Date
    } = {
      updatedAt: new Date(),
    }

    if (data.title !== undefined) updates.title = data.title
    if (data.content !== undefined) updates.content = data.content || null
    if (data.linkUrl !== undefined) updates.linkUrl = data.linkUrl || null
    if (data.linkText !== undefined) updates.linkText = data.linkText || null
    if (data.style !== undefined) updates.style = data.style
    if (data.scope !== undefined) updates.scope = data.scope
    if (data.pathPrefixes !== undefined)
      updates.pathPrefixes = data.pathPrefixes
    if (data.isActive !== undefined) updates.isActive = data.isActive
    if (data.startsAt !== undefined) {
      updates.startsAt = data.startsAt ? new Date(data.startsAt) : null
    }
    if (data.expiresAt !== undefined) {
      updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
    }
    if (data.priority !== undefined) updates.priority = data.priority

    await db.update(banners).set(updates).where(eq(banners.id, data.id))

    return { success: true }
  })

// Delete banner (admin)
export const deleteBanner = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()

    const existing = await db.query.banners.findFirst({
      where: eq(banners.id, data.id),
    })

    if (!existing) {
      throw new Error('Banner not found')
    }

    // Delete banner (cascades to dismissals)
    await db.delete(banners).where(eq(banners.id, data.id))

    return { success: true }
  })

// Toggle banner active state (admin)
export const toggleBannerActive = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()

    const existing = await db.query.banners.findFirst({
      where: eq(banners.id, data.id),
    })

    if (!existing) {
      throw new Error('Banner not found')
    }

    await db
      .update(banners)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(banners.id, data.id))

    return { success: true }
  })
