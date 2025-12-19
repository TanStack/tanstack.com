import { db } from '~/db/client'
import { docFeedback, type DocFeedbackStatus } from '~/db/schema'
import { and, eq, gte, sql } from 'drizzle-orm'
import { requireCapability } from './auth.server'
import { getEffectiveCapabilities } from './capabilities.server'

/**
 * Require the user to have the moderate-feedback capability
 */
export async function requireModerateFeedback() {
  return await requireCapability({
    data: { capability: 'moderate-feedback' },
  })
}

/**
 * Calculate points from character count and feedback type
 * Personal notes earn 0 points
 * Improvements: 0.1 points per character, min 1 point (10 chars), soft cap 100 points (1000 chars)
 */
export function calculatePoints(
  characterCount: number,
  type: 'note' | 'improvement',
): number {
  // Personal notes don't earn points
  if (type === 'note') {
    return 0
  }

  // Minimum 10 characters = 1 point
  if (characterCount < 10) {
    return Math.max(0, characterCount * 0.1)
  }

  // Soft cap at 1000 characters = 100 points
  if (characterCount >= 1000) {
    return 100
  }

  // Linear scaling between 10 and 1000 characters
  return characterCount * 0.1
}

/**
 * Generate a hierarchical selector for a block element
 * Returns a selector like: "section[1] > h2[0] > p[2]"
 */
export function generateBlockSelector(
  elementPath: Array<{ tag: string; index: number }>,
): string {
  return elementPath.map((el) => `${el.tag}[${el.index}]`).join(' > ')
}

/**
 * Generate SHA-256 hash of block content for drift detection
 */
export async function generateContentHash(content: string): Promise<string> {
  // Use Web Crypto API (available in Node.js 15+)
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check if the user can moderate feedback (has moderate-feedback or admin capability)
 */
export async function canModerateFeedback(userId: string): Promise<boolean> {
  const capabilities = await getEffectiveCapabilities(userId)
  return (
    capabilities.includes('moderate-feedback') || capabilities.includes('admin')
  )
}

/**
 * Get user's total approved feedback points
 */
export async function getUserTotalPoints(userId: string): Promise<number> {
  const result = await db
    .select({
      characterCount: docFeedback.characterCount,
      type: docFeedback.type,
    })
    .from(docFeedback)
    .where(
      and(
        eq(docFeedback.userId, userId),
        eq(docFeedback.status, 'approved' as DocFeedbackStatus),
      ),
    )

  // Calculate total points in JS

  return result.reduce((sum, item) => {
    return sum + calculatePoints(item.characterCount, item.type)
  }, 0)
}

/**
 * Get feedback statistics for a user
 */
export async function getUserFeedbackStats(userId: string) {
  // Only count improvements for status stats (notes are private and don't need moderation)
  const feedback = await db
    .select({
      status: docFeedback.status,
      characterCount: docFeedback.characterCount,
      type: docFeedback.type,
    })
    .from(docFeedback)
    .where(
      and(eq(docFeedback.userId, userId), eq(docFeedback.type, 'improvement')),
    )

  // Calculate stats in JS
  const statsMap = {
    pending: { count: 0, points: 0 },
    approved: { count: 0, points: 0 },
    denied: { count: 0, points: 0 },
  }

  feedback.forEach((item) => {
    const points = calculatePoints(item.characterCount, item.type)
    statsMap[item.status].count++
    statsMap[item.status].points += points
  })

  const total = Object.values(statsMap).reduce(
    (sum, stat) => sum + stat.count,
    0,
  )

  return {
    total,
    totalApprovedPoints: statsMap.approved.points,
    byStatus: statsMap,
  }
}

/**
 * Validate that user owns the feedback
 */
export async function validateFeedbackOwnership(
  feedbackId: string,
  userId: string,
): Promise<void> {
  const feedback = await db.query.docFeedback.findFirst({
    where: eq(docFeedback.id, feedbackId),
  })

  if (!feedback) {
    throw new Error('Feedback not found')
  }

  if (feedback.userId !== userId) {
    throw new Error('You do not have permission to modify this feedback')
  }
}

/**
 * Check rate limit for feedback submissions
 * Returns true if rate limit is exceeded, false otherwise
 */
export async function checkRateLimit(userId: string): Promise<boolean> {
  // Limit: 10 submissions per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const recentSubmissions = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(docFeedback)
    .where(
      and(
        eq(docFeedback.userId, userId),
        gte(docFeedback.createdAt, oneHourAgo),
      ),
    )

  const count = recentSubmissions[0]?.count ?? 0
  return count >= 10
}
