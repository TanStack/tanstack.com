import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { env } from './env'

// Track rate limit warnings per API to avoid spam (one warning per API key)
const rateLimitWarnings = new Set<string>()

export interface Library {
  id: string
  repo: string
  frameworks?: string[]
}

export interface GitHubStats {
  starCount: number
  contributorCount: number
  dependentCount: number
}

export interface NpmStats {
  totalDownloads: number
  packages?: string
}

export interface OSSStats {
  github: GitHubStats
  npm: NpmStats
}

/**
 * Fetch GitHub repository statistics
 */
async function fetchGitHubRepoStats(repo: string): Promise<GitHubStats> {
  const token = env.GITHUB_AUTH_TOKEN
  if (!token) {
    throw new Error('GITHUB_AUTH_TOKEN not configured')
  }

  const [repoData, contributors, dependents] = await Promise.all([
    // Get repo basic stats
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TanStack-Stats',
      },
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`)
      }
      return res.json()
    }),

    // Get contributor count (paginated, get first page to check total)
    fetch(
      `https://api.github.com/repos/${repo}/contributors?per_page=1&anon=false`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'TanStack-Stats',
        },
      }
    ).then(async (res) => {
      if (!res.ok) {
        // Some repos don't allow contributor access, return 0
        if (res.status === 403 || res.status === 404) {
          return { count: 0 }
        }
        throw new Error(`GitHub API error: ${res.status}`)
      }
      // Get total from Link header if available
      const linkHeader = res.headers.get('Link')
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/)
        if (match) {
          return { count: parseInt(match[1], 10) }
        }
      }
      // Fallback: fetch all contributors (limited to 100)
      const contributors = await res.json()
      return { count: contributors.length }
    }),

    // Get dependent repositories count
    fetch(`https://api.github.com/repos/${repo}/dependents?per_page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TanStack-Stats',
      },
    }).then(async (res) => {
      if (!res.ok) {
        // Dependents endpoint may not be available for all repos
        if (res.status === 403 || res.status === 404) {
          return { count: 0 }
        }
        throw new Error(`GitHub API error: ${res.status}`)
      }
      const linkHeader = res.headers.get('Link')
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/)
        if (match) {
          return { count: parseInt(match[1], 10) }
        }
      }
      const dependents = await res.json()
      return { count: dependents.length }
    }),
  ])

  return {
    starCount: repoData.stargazers_count ?? 0,
    contributorCount: contributors.count ?? 0,
    dependentCount: dependents.count ?? 0,
  }
}

/**
 * Fetch GitHub organization statistics (aggregate across all repos)
 */
async function fetchGitHubOwnerStats(owner: string): Promise<GitHubStats> {
  const token = env.GITHUB_AUTH_TOKEN
  if (!token) {
    throw new Error('GITHUB_AUTH_TOKEN not configured')
  }

  // Fetch all repos for the organization
  const repos: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetch(
      `https://api.github.com/orgs/${owner}/repos?per_page=100&page=${page}&sort=stars`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'TanStack-Stats',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const pageRepos = await response.json()
    repos.push(...pageRepos)

    // Check if there are more pages
    const linkHeader = response.headers.get('Link')
    hasMore = linkHeader?.includes('rel="next"') ?? false
    page++
  }

  // Aggregate stats
  const starCount = repos.reduce(
    (sum, repo) => sum + (repo.stargazers_count ?? 0),
    0
  )

  // Get unique contributors across all repos (approximate)
  // Note: This is expensive, so we'll use a simplified approach
  // Get contributors from top repos only
  const topRepos = repos
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 10)

  const contributorSets = await Promise.all(
    topRepos.map(async (repo) => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repo.full_name}/contributors?per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'TanStack-Stats',
            },
          }
        )
        if (!response.ok) return new Set()
        const contributors = await response.json()
        return new Set(contributors.map((c: any) => c.login))
      } catch {
        return new Set()
      }
    })
  )

  const uniqueContributors = new Set(
    contributorSets.flatMap((set) => Array.from(set))
  )

  // Get dependent count (sum across repos)
  const dependentCounts = await Promise.all(
    topRepos.map(async (repo) => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repo.full_name}/dependents?per_page=1`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'TanStack-Stats',
            },
          }
        )
        if (!response.ok) return 0
        const linkHeader = response.headers.get('Link')
        if (linkHeader) {
          const match = linkHeader.match(/page=(\d+)>; rel="last"/)
          if (match) {
            return parseInt(match[1], 10)
          }
        }
        return 0
      } catch {
        return 0
      }
    })
  )

  const dependentCount = dependentCounts.reduce((sum, count) => sum + count, 0)

  return {
    starCount,
    contributorCount: uniqueContributors.size,
    dependentCount,
  }
}

/**
 * Fetch NPM package download statistics with rate limiting
 */
async function fetchNpmPackageStats(packageNames: string[]): Promise<NpmStats> {
  // Fetch download counts with rate limiting (delay between requests)
  const downloadCounts: number[] = []

  for (let i = 0; i < packageNames.length; i++) {
    const packageName = packageNames[i]

    // Add delay between requests to avoid rate limiting (except for first request)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200)) // 200ms delay
    }

    let retries = 3
    let lastError: Error | null = null

    while (retries > 0) {
      try {
        const response = await fetch(
          `https://api.npmjs.org/downloads/point/last-year/${packageName}`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'TanStack-Stats',
            },
          }
        )

        if (!response.ok) {
          if (response.status === 404) {
            downloadCounts.push(0) // Package doesn't exist
            break
          }

          if (response.status === 429) {
            // Rate limited - wait longer and retry
            const retryAfter = response.headers.get('Retry-After')
            const waitTime = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : Math.pow(2, 4 - retries) * 1000 // Exponential backoff

            // Only log warning once per API (NPM) per session
            if (!rateLimitWarnings.has('npm-api')) {
              rateLimitWarnings.add('npm-api')
              console.warn(
                `NPM API rate limited, waiting ${waitTime}ms before retry...`
              )
            }

            if (retries > 1) {
              await new Promise((resolve) => setTimeout(resolve, waitTime))
              retries--
              continue
            } else {
              // Last retry failed, skip this package (silently)
              downloadCounts.push(0)
              break
            }
          }

          throw new Error(`NPM API error: ${response.status}`)
        }

        const data = await response.json()
        downloadCounts.push(data.downloads ?? 0)
        break // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        retries--

        if (retries > 0) {
          const waitTime = Math.pow(2, 4 - retries) * 1000
          console.warn(
            `Error fetching NPM stats for ${packageName}, retrying in ${waitTime}ms...`,
            lastError.message
          )
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        } else {
          console.error(
            `Error fetching NPM stats for ${packageName} after all retries:`,
            lastError.message
          )
          downloadCounts.push(0) // Failed after retries, use 0
        }
      }
    }
  }

  const totalDownloads = downloadCounts.reduce((sum, count) => sum + count, 0)

  return {
    totalDownloads,
  }
}

/**
 * Fetch NPM organization statistics
 */
async function fetchNpmOrgStats(org: string): Promise<NpmStats> {
  // Fetch all packages in the org
  let retries = 3
  let lastError: Error | null = null

  while (retries > 0) {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/-/org/${org}/package`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TanStack-Stats',
          },
        }
      )

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, 4 - retries) * 1000

          // Only log warning once per API (NPM) per session
          if (!rateLimitWarnings.has('npm-api')) {
            rateLimitWarnings.add('npm-api')
            console.warn(
              `NPM API rate limited, waiting ${waitTime}ms before retry...`
            )
          }

          if (retries > 1) {
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            retries--
            continue
          } else {
            throw new Error(`NPM API rate limited: ${response.status}`)
          }
        }

        throw new Error(`NPM API error: ${response.status}`)
      }

      const data = await response.json()
      const packageNames = Object.keys(data)

      return fetchNpmPackageStats(packageNames)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      retries--

      if (retries > 0) {
        const waitTime = Math.pow(2, 4 - retries) * 1000
        console.warn(
          `Error fetching NPM org stats for ${org}, retrying in ${waitTime}ms...`,
          lastError.message
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      } else {
        console.error(
          `Error fetching NPM org stats for ${org} after all retries:`,
          lastError.message
        )
        return { totalDownloads: 0 }
      }
    }
  }

  return { totalDownloads: 0 }
}

/**
 * Server function to get OSS statistics
 */
export const getOSSStats = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      library: z
        .object({
          id: z.string(),
          repo: z.string(),
          frameworks: z.array(z.string()).optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }): Promise<OSSStats> => {
    if (data.library) {
      // Get stats for a specific library
      const [githubStats, npmStats] = await Promise.all([
        fetchGitHubRepoStats(data.library.repo),
        data.library.frameworks && data.library.frameworks.length > 0
          ? fetchNpmPackageStats(
              data.library.frameworks.map(
                (framework) => `@tanstack/${framework}-${data.library!.id}`
              )
            )
          : fetchNpmPackageStats([`@tanstack/${data.library.id}`]),
      ])

      return {
        github: githubStats,
        npm: npmStats,
      }
    } else {
      // Get aggregate stats for TanStack org
      const [githubStats, npmStats] = await Promise.all([
        fetchGitHubOwnerStats('tanstack'),
        fetchNpmOrgStats('tanstack'),
      ])

      return {
        github: githubStats,
        npm: npmStats,
      }
    }
  })
