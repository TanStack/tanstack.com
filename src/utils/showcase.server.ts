import { db } from '~/db/client'
import { showcases } from '~/db/schema'
import { and, eq, gte, sql } from 'drizzle-orm'
import { requireCapability } from './auth.server'
import { getEffectiveCapabilities } from './capabilities.server'

/**
 * Require the user to have the moderate-showcases capability
 */
export async function requireModerateShowcases() {
  return await requireCapability({
    data: { capability: 'moderate-showcases' },
  })
}

/**
 * Check if the user can moderate showcases (has moderate-showcases or admin capability)
 */
export async function canModerateShowcases(userId: string): Promise<boolean> {
  const capabilities = await getEffectiveCapabilities(userId)
  return (
    capabilities.includes('moderate-showcases') ||
    capabilities.includes('admin')
  )
}

/**
 * Validate that user owns the showcase
 */
export async function validateShowcaseOwnership(
  showcaseId: string,
  userId: string,
): Promise<void> {
  const showcase = await db.query.showcases.findFirst({
    where: eq(showcases.id, showcaseId),
  })

  if (!showcase) {
    throw new Error('Showcase not found')
  }

  if (showcase.userId !== userId) {
    throw new Error('You do not have permission to modify this showcase')
  }
}

/**
 * Check rate limit for showcase submissions
 * Returns true if rate limit is exceeded, false otherwise
 */
export async function checkShowcaseRateLimit(userId: string): Promise<boolean> {
  // Limit: 5 submissions per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const recentSubmissions = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(showcases)
    .where(
      and(eq(showcases.userId, userId), gte(showcases.createdAt, oneDayAgo)),
    )

  const count = recentSubmissions[0]?.count ?? 0
  return count >= 5
}

/**
 * Library dependencies: Start automatically includes Router
 */
export function expandLibraryDependencies(libraries: string[]): string[] {
  const expanded = new Set(libraries)

  // If 'start' is selected, automatically include 'router'
  if (expanded.has('start')) {
    expanded.add('router')
  }

  return Array.from(expanded)
}

/**
 * Get libraries that are auto-included (for UI display)
 */
export function getAutoIncludedLibraries(
  selectedLibraries: string[],
): Record<string, string> {
  const autoIncluded: Record<string, string> = {}

  if (selectedLibraries.includes('start')) {
    autoIncluded['router'] = 'Included via Start'
  }

  return autoIncluded
}

/**
 * Valid URL check (basic format validation)
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
