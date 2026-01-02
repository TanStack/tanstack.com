import { db } from '~/db/client'
import { userActivity, users } from '~/db/schema'
import { eq, sql, desc, gte, and } from 'drizzle-orm'

// Get today's date in YYYY-MM-DD format (UTC)
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Record daily activity for a user (upsert - one row per user per day)
export async function recordDailyActivity(userId: string): Promise<void> {
  const today = getTodayDate()

  // Use ON CONFLICT to upsert (insert or do nothing if already exists)
  await db
    .insert(userActivity)
    .values({
      userId,
      date: today,
    })
    .onConflictDoNothing({
      target: [userActivity.userId, userActivity.date],
    })
}

// Calculate current streak for a user (consecutive days ending today or yesterday)
export async function getUserStreak(userId: string): Promise<{
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  totalActiveDays: number
}> {
  // Get all activity dates for user, ordered by date descending
  const activities = await db
    .select({ date: userActivity.date })
    .from(userActivity)
    .where(eq(userActivity.userId, userId))
    .orderBy(desc(userActivity.date))

  if (activities.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      totalActiveDays: 0,
    }
  }

  const today = getTodayDate()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const dates = activities.map((a) => a.date)
  const lastActiveDate = dates[0]

  // Current streak: must include today or yesterday to be "current"
  let currentStreak = 0
  if (lastActiveDate === today || lastActiveDate === yesterday) {
    currentStreak = 1
    let expectedDate = new Date(lastActiveDate)

    for (let i = 1; i < dates.length; i++) {
      expectedDate.setDate(expectedDate.getDate() - 1)
      const expectedDateStr = expectedDate.toISOString().split('T')[0]

      if (dates[i] === expectedDateStr) {
        currentStreak++
      } else {
        break
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0
  let tempStreak = 1

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1])
    const currDate = new Date(dates[i])
    const diffDays = Math.round(
      (prevDate.getTime() - currDate.getTime()) / (24 * 60 * 60 * 1000),
    )

    if (diffDays === 1) {
      tempStreak++
    } else {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak)

  return {
    currentStreak,
    longestStreak,
    lastActiveDate,
    totalActiveDays: dates.length,
  }
}

// Get DAU/WAU/MAU stats
export async function getActiveUserStats(): Promise<{
  dau: number
  wau: number
  mau: number
  dauYesterday: number
}> {
  const today = getTodayDate()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const [dauResult] = await db
    .select({ count: sql<number>`count(distinct ${userActivity.userId})` })
    .from(userActivity)
    .where(eq(userActivity.date, today))

  const [dauYesterdayResult] = await db
    .select({ count: sql<number>`count(distinct ${userActivity.userId})` })
    .from(userActivity)
    .where(eq(userActivity.date, yesterday))

  const [wauResult] = await db
    .select({ count: sql<number>`count(distinct ${userActivity.userId})` })
    .from(userActivity)
    .where(gte(userActivity.date, last7Days))

  const [mauResult] = await db
    .select({ count: sql<number>`count(distinct ${userActivity.userId})` })
    .from(userActivity)
    .where(gte(userActivity.date, last30Days))

  return {
    dau: Number(dauResult.count),
    dauYesterday: Number(dauYesterdayResult.count),
    wau: Number(wauResult.count),
    mau: Number(mauResult.count),
  }
}

// Get top users by streak (for admin leaderboard)
export async function getStreakLeaderboard(limit: number = 10): Promise<
  Array<{
    userId: string
    userName: string | null
    userEmail: string | null
    userImage: string | null
    currentStreak: number
    longestStreak: number
    totalActiveDays: number
  }>
> {
  // Get users who have been active in the last 30 days
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const activeUsers = await db
    .selectDistinct({ userId: userActivity.userId })
    .from(userActivity)
    .where(gte(userActivity.date, last30Days))

  // Calculate streaks for each user
  const streakData = await Promise.all(
    activeUsers.map(async ({ userId }) => {
      const streak = await getUserStreak(userId)
      return { userId, ...streak }
    }),
  )

  // Sort by current streak, then longest streak
  streakData.sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) {
      return b.currentStreak - a.currentStreak
    }
    return b.longestStreak - a.longestStreak
  })

  // Get top N and fetch user info
  const topUsers = streakData.slice(0, limit)

  if (topUsers.length === 0) {
    return []
  }

  const userIds = topUsers.map((u) => u.userId)
  const userInfos = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(sql`${users.id} IN ${sql.raw(`('${userIds.join("','")}')`)}`)

  const userMap = new Map(userInfos.map((u) => [u.id, u]))

  return topUsers.map((u) => {
    const userInfo = userMap.get(u.userId)
    return {
      userId: u.userId,
      userName: userInfo?.name ?? null,
      userEmail: userInfo?.email ?? null,
      userImage: userInfo?.image ?? null,
      currentStreak: u.currentStreak,
      longestStreak: u.longestStreak,
      totalActiveDays: u.totalActiveDays,
    }
  })
}

// Get daily active user counts for chart (last 30 days)
export async function getDailyActiveUserCounts(): Promise<
  Array<{ date: string; count: number }>
> {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const results = await db
    .select({
      date: userActivity.date,
      count: sql<number>`count(distinct ${userActivity.userId})`,
    })
    .from(userActivity)
    .where(gte(userActivity.date, last30Days))
    .groupBy(userActivity.date)
    .orderBy(userActivity.date)

  return results.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }))
}
