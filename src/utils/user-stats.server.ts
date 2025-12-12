/**
 * Server functions for user statistics
 */

import { createServerFn } from '@tanstack/react-start'
import { db } from '~/db/client'
import { users } from '~/db/schema'
import { requireCapability } from './auth.server'
import { sql, gte, and, eq, lt } from 'drizzle-orm'

/**
 * Get comprehensive user statistics including:
 * - Total users
 * - Users per day (last 7 days)
 * - Users per week (last 4 weeks)
 * - Users per month (last 12 months)
 * - Daily signup data for charting
 * - Ads waitlist statistics
 * - Ads disabled statistics
 */
export const getUserStats = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    // Get total user count
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)

    const totalUsers = totalUsersResult[0]?.count ?? 0

    // Get users created in last 7 days (for daily breakdown)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentUsers = await db.query.users.findMany({
      where: gte(users.createdAt, sevenDaysAgo),
      columns: {
        createdAt: true,
      },
    })

    // Calculate daily signups for last 7 days
    const dailySignups: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      dailySignups[dateKey] = 0
    }

    recentUsers.forEach((user) => {
      const dateKey = user.createdAt.toISOString().split('T')[0]
      if (dateKey in dailySignups) {
        dailySignups[dateKey]++
      }
    })

    // Get daily signup counts (aggregated by day)
    // This gives us efficient per-day data that can be used for both daily and cumulative charts
    const dailySignupsData = await db
      .select({
        date: sql<string>`DATE(${users.createdAt})`.as('date'),
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(users)
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`)

    // Convert to array of objects with proper date strings
    const signupsPerDay = dailySignupsData.map((row) => ({
      date: row.date,
      count: row.count,
    }))

    // Get ads waitlist statistics
    const adsWaitlistResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.interestedInHidingAds, true))

    const adsWaitlistCount = adsWaitlistResult[0]?.count ?? 0

    // Get ads disabled statistics
    const adsDisabledResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.adsDisabled, true))

    const adsDisabledCount = adsDisabledResult[0]?.count ?? 0

    // Get users with disableAds capability
    const adsCapabilityResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`'disableAds' = ANY(${users.capabilities})`)

    const adsCapabilityCount = adsCapabilityResult[0]?.count ?? 0

    // Get users on waitlist who now have ads disabled
    const waitlistWithAdsDisabledResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.interestedInHidingAds, true),
          eq(users.adsDisabled, true),
        ),
      )

    const waitlistWithAdsDisabledCount =
      waitlistWithAdsDisabledResult[0]?.count ?? 0

    // Calculate average signups per day (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const last30DaysResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))

    const last30DaysCount = last30DaysResult[0]?.count ?? 0
    const avgSignupsPerDay = Math.round(last30DaysCount / 30)

    // Calculate today's signups
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, todayStart))

    const todaySignups = todayResult[0]?.count ?? 0

    // Calculate yesterday's signups
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const yesterdayResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          gte(users.createdAt, yesterdayStart),
          lt(users.createdAt, todayStart),
        ),
      )

    const yesterdaySignups = yesterdayResult[0]?.count ?? 0

    return {
      totalUsers,
      todaySignups,
      yesterdaySignups,
      avgSignupsPerDay,
      dailySignups,
      signupsPerDay, // Daily signup counts for charting
      ads: {
        waitlistCount: adsWaitlistCount,
        disabledCount: adsDisabledCount,
        capabilityCount: adsCapabilityCount,
        waitlistWithAdsDisabledCount,
        waitlistConversionRate:
          adsWaitlistCount > 0
            ? Math.round(
                (waitlistWithAdsDisabledCount / adsWaitlistCount) * 100,
              )
            : 0,
      },
    }
  },
)
