import { action } from '../_generated/server'
import { v } from 'convex/values'
import { api } from '../_generated/api'

/**
 * Map GitHub repo names to library IDs
 */
const REPO_TO_LIBRARY_ID: Record<string, string> = {
  'tanstack/start': 'start',
  'tanstack/router': 'router',
  'tanstack/query': 'query',
  'tanstack/table': 'table',
  'tanstack/form': 'form',
  'tanstack/virtual': 'virtual',
  'tanstack/ranger': 'ranger',
  'tanstack/store': 'store',
  'tanstack/pacer': 'pacer',
  'tanstack/db': 'db',
  'tanstack/config': 'config',
  'tanstack/devtools': 'devtools',
  'tanstack/react-charts': 'react-charts',
  'tanstack/create-tsrouter-app': 'create-tsrouter-app',
}

/**
 * Parse semantic version to determine release type and priority
 */
function parseVersion(version: string): {
  releaseType: 'major' | 'minor' | 'patch' | 'prerelease'
  priority: number
} {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/i, '')

  // Check for prerelease markers
  if (
    cleanVersion.includes('-') ||
    cleanVersion.includes('alpha') ||
    cleanVersion.includes('beta') ||
    cleanVersion.includes('rc')
  ) {
    return { releaseType: 'prerelease', priority: 10 }
  }

  const parts = cleanVersion.split('.').map(Number)

  if (parts.length < 2) {
    return { releaseType: 'patch', priority: 20 }
  }

  const [major, minor, patch] = parts

  if (major > 0 && minor === 0 && (!patch || patch === 0)) {
    return { releaseType: 'major', priority: 80 }
  }

  if (minor > 0 && (!patch || patch === 0)) {
    return { releaseType: 'minor', priority: 60 }
  }

  return { releaseType: 'patch', priority: 20 }
}

/**
 * Normalize GitHub release to feed entry format
 */
export function normalizeGitHubRelease(release: {
  id: number
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  author?: { login: string }
  repo: string
}): {
  id: string
  source: string
  title: string
  content: string
  excerpt?: string
  publishedAt: number
  metadata: any
  libraryIds: string[]
  partnerIds?: string[]
  tags: string[]
  category: 'release' | 'announcement' | 'blog' | 'partner' | 'update' | 'other'
  isVisible: boolean
  priority: number
  featured?: boolean
  autoSynced: boolean
} {
  const { releaseType, priority } = parseVersion(release.tag_name)
  const libraryId = REPO_TO_LIBRARY_ID[release.repo]

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
    `source:github`,
    ...(libraryId ? [`library:${libraryId}`] : []),
  ]

  // Default: hide patch releases unless manually featured
  const isVisible = releaseType !== 'patch'

  return {
    id,
    source: 'github',
    title: release.name || `${release.repo} ${release.tag_name}`,
    content: release.body || '',
    excerpt,
    publishedAt: new Date(release.published_at).getTime(),
    metadata: {
      repo: release.repo,
      releaseId: release.id.toString(),
      version: release.tag_name,
      releaseType,
      url: release.html_url,
      author: release.author?.login,
    },
    libraryIds: libraryId ? [libraryId] : [],
    tags,
    category: 'release',
    isVisible,
    priority,
    autoSynced: true,
  }
}

/**
 * Get the last sync timestamp for a repo from feedConfig
 */
async function getLastSyncTime(ctx: any, repo: string): Promise<number | null> {
  const configKey = `github:sync:${repo}`
  const config = await ctx.runQuery(api.feed.queries.getFeedConfig, {
    key: configKey,
  })
  return config?.value?.lastSyncedAt ?? null
}

/**
 * Update the last sync timestamp for a repo in feedConfig
 */
async function updateLastSyncTime(
  ctx: any,
  repo: string,
  timestamp: number
): Promise<void> {
  const configKey = `github:sync:${repo}`
  await ctx.runMutation(api.feed.mutations.setFeedConfig, {
    key: configKey,
    value: { lastSyncedAt: timestamp },
  })
}

/**
 * Fetch releases from GitHub API for a specific repo
 * @param repo - GitHub repo (e.g., 'tanstack/query')
 * @param token - GitHub auth token
 * @param since - Only fetch releases published after this timestamp (optional)
 */
async function fetchRepoReleases(
  repo: string,
  token: string,
  since?: number
): Promise<any[]> {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=100&page=1`

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'TanStack-Feed',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      // Repo doesn't exist or has no releases
      return []
    }
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    )
  }

  const releases = await response.json()

  // Filter by since timestamp if provided
  if (since && since > 0) {
    return releases.filter(
      (release: any) => new Date(release.published_at).getTime() > since
    )
  }

  return releases
}

/**
 * Sync GitHub releases for all TanStack repos
 */
export const syncGitHubReleases = action({
  args: {
    // Optional: number of days to look back for initial sync (default: 30 days)
    // Only used if no previous sync timestamp exists for a repo
    // Set to 0 or undefined to sync all releases on first run
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_AUTH_TOKEN
    if (!token) {
      throw new Error(
        'GITHUB_AUTH_TOKEN not configured. Please set it in Convex dashboard.'
      )
    }

    const repos = Object.keys(REPO_TO_LIBRARY_ID)
    const now = Date.now()
    const defaultDaysBack = args.daysBack ?? 30
    let syncedCount = 0
    let errorCount = 0
    let skippedCount = 0

    for (const repo of repos) {
      try {
        // Get last sync time for this repo
        const lastSyncTime = await getLastSyncTime(ctx, repo)

        // Determine cutoff date:
        // - If we have a last sync time, use it (only fetch new releases)
        // - Otherwise, use daysBack parameter for initial sync
        const cutoffDate = lastSyncTime
          ? lastSyncTime
          : defaultDaysBack > 0
          ? now - defaultDaysBack * 24 * 60 * 60 * 1000
          : 0

        // Fetch releases (will be filtered by cutoffDate in fetchRepoReleases)
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
            const normalized = normalizeGitHubRelease({
              ...release,
              repo,
            })

            // Check if entry already exists
            const existing = await ctx.runQuery(api.feed.queries.getFeedEntry, {
              id: normalized.id,
            })

            if (existing) {
              // Update existing entry
              // Don't update publishedAt for auto-synced entries - preserve original publication date
              await ctx.runMutation(api.feed.mutations.updateFeedEntry, {
                id: normalized.id,
                title: normalized.title,
                content: normalized.content,
                excerpt: normalized.excerpt,
                // Only update publishedAt if it's not set or if entry was manually created
                // For auto-synced entries, preserve the original publishedAt
                publishedAt: existing.autoSynced
                  ? undefined
                  : normalized.publishedAt,
                metadata: normalized.metadata,
                libraryIds: normalized.libraryIds,
                tags: normalized.tags,
                priority: normalized.priority,
                lastSyncedAt: now,
              })
            } else {
              // Create new entry
              await ctx.runMutation(api.feed.mutations.createFeedEntry, {
                ...normalized,
              })
            }

            repoSyncedCount++
            syncedCount++
          } catch (error) {
            console.error(
              `Error processing release ${release.id} from ${repo}:`,
              error
            )
            errorCount++
          }
        }

        // Update last sync time for this repo if we processed any releases
        if (repoSyncedCount > 0 && repoLatestReleaseTime > cutoffDate) {
          await updateLastSyncTime(ctx, repo, repoLatestReleaseTime)
        } else if (!lastSyncTime && repoSyncedCount === 0) {
          // If this is the first sync and no releases found, set sync time to now
          // to prevent re-fetching on next sync
          await updateLastSyncTime(ctx, repo, now)
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
  },
})
