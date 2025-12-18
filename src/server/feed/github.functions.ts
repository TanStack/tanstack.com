/**
 * Pure GitHub sync functions that can be used by both TanStack Start server functions
 * and Netlify functions. No TanStack Start dependencies.
 */

import { envFunctions } from '~/utils/env.functions'
import { db } from '~/db/client'
import { feedEntries, feedConfig } from '~/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Dynamically build repo to library ID mapping from libraries list
 * This ensures we always sync all libraries without maintaining a duplicate list
 */
async function getRepoToLibraryIdMap(): Promise<Record<string, string>> {
  const { libraries } = await import('~/libraries')
  const mapping: Record<string, string> = {}

  for (const library of libraries) {
    if (library.repo && library.id) {
      mapping[library.repo] = library.id
    }
  }

  return mapping
}

/**
 * Parse semantic version to determine release type
 */
function parseVersion(version: string): {
  releaseType: 'major' | 'minor' | 'patch'
  isPrerelease: boolean
} {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/i, '')

  // Check for prerelease markers
  const isPrerelease =
    cleanVersion.includes('-') ||
    cleanVersion.includes('alpha') ||
    cleanVersion.includes('beta') ||
    cleanVersion.includes('rc')

  // Extract base version (before prerelease markers)
  const baseVersion = cleanVersion.split('-')[0].split('+')[0]
  const parts = baseVersion.split('.').map(Number)

  if (parts.length < 2) {
    return { releaseType: 'patch', isPrerelease }
  }

  const [major, minor, patch] = parts

  if (major > 0 && minor === 0 && (!patch || patch === 0)) {
    return { releaseType: 'major', isPrerelease }
  }

  if (minor > 0 && (!patch || patch === 0)) {
    return { releaseType: 'minor', isPrerelease }
  }

  return { releaseType: 'patch', isPrerelease }
}

/**
 * Normalize GitHub release to feed entry format
 */
export async function normalizeGitHubRelease(release: {
  id: number
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  author?: { login: string }
  repo: string
}): Promise<{
  id: string
  entryType: 'release' | 'blog' | 'announcement'
  title: string
  content: string
  excerpt?: string
  publishedAt: number
  metadata: any
  libraryIds: string[]
  partnerIds?: string[]
  tags: string[]
  showInFeed: boolean
  featured?: boolean
  autoSynced: boolean
}> {
  const { releaseType, isPrerelease } = parseVersion(release.tag_name)
  const repoToLibraryId = await getRepoToLibraryIdMap()
  const libraryId = repoToLibraryId[release.repo]

  // Generate unique ID
  const id = `github:${release.repo}:${release.tag_name}`

  // Extract excerpt from body (first paragraph or first 200 chars)
  const excerpt = release.body
    .split('\n\n')[0]
    .substring(0, 200)
    .trim()
    .replace(/\n/g, ' ')

  // Build tags
  const tags = [
    `release:${releaseType}`,
    ...(isPrerelease ? ['release:prerelease'] : []),
    `source:github`,
    ...(libraryId ? [`library:${libraryId}`] : []),
  ]

  return {
    id,
    entryType: 'release',
    title: release.name || `${release.repo} ${release.tag_name}`,
    content: release.body || '',
    excerpt,
    publishedAt: new Date(release.published_at).getTime(),
    metadata: {
      repo: release.repo,
      releaseId: release.id.toString(),
      version: release.tag_name,
      releaseType,
      isPrerelease,
      url: release.html_url,
      author: release.author?.login,
    },
    libraryIds: libraryId ? [libraryId] : [],
    tags,
    showInFeed: true,
    autoSynced: true,
  }
}

/**
 * Get the last sync timestamp for a repo from feedConfig
 */
async function getLastSyncTime(repo: string): Promise<number | null> {
  const configKey = `github:sync:${repo}`
  const config = await db.query.feedConfig.findFirst({
    where: eq(feedConfig.key, configKey),
  })

  if (!config) {
    return null
  }

  const configValue = config.value as { lastSyncedAt?: number } | null
  return configValue?.lastSyncedAt ?? null
}

/**
 * Update the last sync timestamp for a repo in feedConfig
 */
async function updateLastSyncTime(
  repo: string,
  timestamp: number,
): Promise<void> {
  const configKey = `github:sync:${repo}`
  const existing = await db.query.feedConfig.findFirst({
    where: eq(feedConfig.key, configKey),
  })

  if (existing) {
    await db
      .update(feedConfig)
      .set({ value: { lastSyncedAt: timestamp }, updatedAt: new Date() })
      .where(eq(feedConfig.key, configKey))
  } else {
    await db.insert(feedConfig).values({
      key: configKey,
      value: { lastSyncedAt: timestamp },
    })
  }
}

/**
 * Fetch releases from GitHub API for a specific repo
 */
async function fetchRepoReleases(
  repo: string,
  token: string,
  since?: number,
): Promise<any[]> {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=100&page=1`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'TanStack-Feed',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return []
    }
    let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`
    try {
      const errorBody = await response.text()
      if (errorBody) {
        const errorJson = JSON.parse(errorBody)
        if (errorJson.message) {
          errorMessage += ` - ${errorJson.message}`
        }
      }
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorMessage)
  }

  const releases = await response.json()

  // Filter by since timestamp if provided
  if (since && since > 0) {
    return releases.filter(
      (release: any) => new Date(release.published_at).getTime() > since,
    )
  }

  return releases
}

/**
 * Sync GitHub releases for all TanStack repos
 */
export async function syncGitHubReleases(options?: { daysBack?: number }) {
  const token = envFunctions.GITHUB_AUTH_TOKEN
  if (!token || token === 'USE_A_REAL_KEY_IN_PRODUCTION') {
    throw new Error(
      'GITHUB_AUTH_TOKEN not configured. Please set it in environment variables.',
    )
  }

  const repoToLibraryId = await getRepoToLibraryIdMap()
  const repos = Object.keys(repoToLibraryId)
  const now = Date.now()
  let syncedCount = 0
  let errorCount = 0
  const skippedCount = 0

  for (const repo of repos) {
    try {
      // Get last sync time for this repo
      const lastSyncTime = await getLastSyncTime(repo)

      // Determine cutoff date
      let cutoffDate: number
      if (options?.daysBack !== undefined) {
        if (options.daysBack === 0) {
          cutoffDate = 0 // Sync all releases
        } else {
          cutoffDate = now - options.daysBack * 24 * 60 * 60 * 1000
        }
      } else if (lastSyncTime) {
        cutoffDate = lastSyncTime
      } else {
        // Default to 2 days for initial sync
        cutoffDate = now - 2 * 24 * 60 * 60 * 1000
      }

      // Fetch releases
      const releases = await fetchRepoReleases(repo, token, cutoffDate)

      let repoSyncedCount = 0
      let repoLatestReleaseTime = cutoffDate

      for (const release of releases) {
        const publishedAt = new Date(release.published_at).getTime()

        // Track the latest release time for this repo
        if (publishedAt > repoLatestReleaseTime) {
          repoLatestReleaseTime = publishedAt
        }

        try {
          const normalized = await normalizeGitHubRelease({
            ...release,
            repo,
          })

          // Check if entry already exists
          const existing = await db.query.feedEntries.findFirst({
            where: eq(feedEntries.entryId, normalized.id),
          })

          if (existing) {
            // Update existing entry (preserve publishedAt for auto-synced entries)
            const isAutoSynced = existing.autoSynced ?? false
            await db
              .update(feedEntries)
              .set({
                title: normalized.title,
                content: normalized.content,
                excerpt: normalized.excerpt,
                publishedAt: isAutoSynced
                  ? existing.publishedAt
                  : new Date(normalized.publishedAt),
                metadata: normalized.metadata,
                libraryIds: normalized.libraryIds,
                tags: normalized.tags,
                lastSyncedAt: new Date(now),
                updatedAt: new Date(),
              })
              .where(eq(feedEntries.entryId, normalized.id))
          } else {
            // Create new entry
            await db.insert(feedEntries).values({
              entryId: normalized.id,
              entryType: normalized.entryType,
              title: normalized.title,
              content: normalized.content,
              excerpt: normalized.excerpt,
              publishedAt: new Date(normalized.publishedAt),
              metadata: normalized.metadata,
              libraryIds: normalized.libraryIds,
              partnerIds: normalized.partnerIds ?? [],
              tags: normalized.tags,
              showInFeed: normalized.showInFeed,
              featured: normalized.featured ?? false,
              autoSynced: normalized.autoSynced,
              lastSyncedAt: new Date(now),
            })
          }

          repoSyncedCount++
          syncedCount++
        } catch (error) {
          console.error(
            `Error processing release ${release.id} from ${repo}:`,
            error,
          )
          errorCount++
        }
      }

      // Update last sync time for this repo if we processed any releases
      if (repoSyncedCount > 0 && repoLatestReleaseTime > cutoffDate) {
        await updateLastSyncTime(repo, repoLatestReleaseTime)
      } else if (!lastSyncTime && repoSyncedCount === 0) {
        // If this is the first sync and no releases found, set sync time to now
        await updateLastSyncTime(repo, now)
      }
    } catch (error) {
      console.error(`Error fetching releases from ${repo}:`, error)
      errorCount++
    }
  }

  return {
    success: true,
    syncedCount,
    errorCount,
    skippedCount,
    reposProcessed: repos.length,
  }
}
