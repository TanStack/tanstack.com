import { pruneStaleCacheRows } from '~/utils/github-content-cache.server'
import {
  refreshGitHubOrgStats,
  refreshNpmOrgStats,
} from '~/utils/stats.functions'
import {
  extractSkillsFromTarball,
  fetchPackument,
  isIntentCompatible,
  searchIntentPackages,
  selectVersionsToSync,
} from '~/utils/intent.server'
import {
  enqueuePackageVersion,
  getKnownVersions,
  getPendingVersions,
  markPackageVerified,
  markVersionFailed,
  markVersionSynced,
  replaceSkillsForVersion,
  upsertIntentPackage,
} from '~/utils/intent-db.server'

const CONTENT_CACHE_PRUNE_CRON = '0 9 * * *'
const STATS_AND_INTENT_DISCOVER_CRON = '0 */6 * * *'
const INTENT_PROCESS_CRON = '*/15 * * * *'
const INTENT_PROCESS_BUDGET_MS = 12 * 60 * 1000

type GitHubSearchResponse = {
  items: Array<{ path: string; repository: { full_name: string } }>
}

type GitHubContentResponse = {
  content?: string
}

type PackageJson = {
  name?: string
  private?: boolean
}

type NpmLatestResponse = {
  dist?: { tarball?: string }
  version?: string
}

export async function runScheduledTasks(cron: string, scheduledTime: number) {
  switch (cron) {
    case CONTENT_CACHE_PRUNE_CRON:
      await runContentCachePrune(scheduledTime)
      return
    case STATS_AND_INTENT_DISCOVER_CRON:
      await Promise.all([
        runGitHubStatsRefresh(scheduledTime),
        runNpmStatsRefresh(scheduledTime),
        runIntentDiscovery(scheduledTime),
      ])
      return
    case INTENT_PROCESS_CRON:
      await runIntentQueueProcess(scheduledTime)
      return
    default:
      console.warn(`[scheduled] No task registered for cron: ${cron}`)
  }
}

async function runContentCachePrune(scheduledTime: number) {
  const startTime = Date.now()
  console.log('[prune-content-cache] Starting prune...')

  try {
    const result = await pruneStaleCacheRows()
    const duration = Date.now() - startTime

    console.log(
      `[prune-content-cache] Completed in ${duration}ms - deleted ${result.githubContentDeleted} content entries (${result.githubContentNegativesDeleted} negatives), ${result.docsArtifactDeleted} artifact entries (cutoff: ${result.cutoff.toISOString()}, negativeCutoff: ${result.negativeCutoff.toISOString()})`,
    )
    console.log(
      '[prune-content-cache] Scheduled time:',
      new Date(scheduledTime).toISOString(),
    )
  } catch (error) {
    logScheduledError('prune-content-cache', startTime, error)
  }
}

async function runGitHubStatsRefresh(scheduledTime: number) {
  const startTime = Date.now()
  console.log('[refresh-github-stats] Starting GitHub stats refresh...')

  try {
    const org = 'tanstack'
    const { orgStats, libraryResults, libraryErrors } =
      await refreshGitHubOrgStats(org)
    const duration = Date.now() - startTime

    console.log(
      `[refresh-github-stats] Completed in ${duration}ms - GitHub Org: ${orgStats.starCount.toLocaleString()} stars, Libraries: ${
        libraryResults.length
      } refreshed, ${libraryErrors.length} failed`,
    )
    console.log(
      '[refresh-github-stats] Scheduled time:',
      new Date(scheduledTime).toISOString(),
    )
  } catch (error) {
    logScheduledError('refresh-github-stats', startTime, error)
  }
}

async function runNpmStatsRefresh(scheduledTime: number) {
  const startTime = Date.now()
  console.log('[refresh-npm-stats] Starting NPM stats refresh...')

  try {
    const org = 'tanstack'

    console.log('[refresh-npm-stats] Refreshing NPM org stats...')
    const npmStats = await refreshNpmOrgStats(org)
    const duration = Date.now() - startTime

    console.log(
      `[refresh-npm-stats] Completed in ${duration}ms - NPM: ${npmStats.totalDownloads.toLocaleString()} downloads (${
        Object.keys(npmStats.packageStats || {}).length
      } packages)`,
    )
    console.log(
      '[refresh-npm-stats] Scheduled time:',
      new Date(scheduledTime).toISOString(),
    )
  } catch (error) {
    logScheduledError('refresh-npm-stats', startTime, error)
  }
}

async function runIntentDiscovery(scheduledTime: number) {
  const startTime = Date.now()
  console.log('[intent-discover] Starting discovery (NPM + GitHub)...')

  let versionsEnqueued = 0
  const errors: Array<string> = []

  try {
    console.log(
      '[intent-discover] Searching NPM for keywords:tanstack-intent...',
    )
    const searchResults = await searchIntentPackages()
    console.log(
      `[intent-discover] NPM found ${searchResults.objects.length} candidates`,
    )

    for (const { package: pkg } of searchResults.objects) {
      try {
        await upsertIntentPackage({ name: pkg.name, verified: false })

        const packument = await fetchPackument(pkg.name)
        const latestVersion = packument['dist-tags'].latest
        if (!latestVersion) continue

        const latestMeta = packument.versions[latestVersion]
        if (!latestMeta || !isIntentCompatible(latestMeta)) continue

        await markPackageVerified(pkg.name)

        const knownVersions = await getKnownVersions(pkg.name)
        const toEnqueue = selectVersionsToSync(packument, knownVersions)
        for (const { publishedAt, tarball, version } of toEnqueue) {
          await enqueuePackageVersion({
            packageName: pkg.name,
            publishedAt,
            tarballUrl: tarball,
            version,
          })
          versionsEnqueued++
        }
        console.log(
          `[intent-discover] NPM: ${pkg.name} - enqueued ${toEnqueue.length}`,
        )
      } catch (error) {
        const message = `npm/${pkg.name}: ${getErrorMessage(error)}`
        console.error(`[intent-discover] ${message}`)
        errors.push(message)
      }
    }
  } catch (error) {
    console.error('[intent-discover] NPM path failed:', getErrorMessage(error))
  }

  const githubToken = process.env.GITHUB_AUTH_TOKEN
  if (githubToken) {
    const githubEnqueued = await discoverIntentPackagesFromGitHub(
      githubToken,
      errors,
    )
    versionsEnqueued += githubEnqueued
  } else {
    console.warn(
      '[intent-discover] GITHUB_AUTH_TOKEN not set, skipping GitHub path',
    )
  }

  const duration = Date.now() - startTime
  console.log(
    `[intent-discover] Done in ${duration}ms - enqueued: ${versionsEnqueued}, errors: ${errors.length}`,
  )
  if (errors.length > 0) {
    console.warn(`[intent-discover] Errors:\n  ${errors.join('\n  ')}`)
  }
  console.log(
    '[intent-discover] Scheduled time:',
    new Date(scheduledTime).toISOString(),
  )
}

async function discoverIntentPackagesFromGitHub(
  githubToken: string,
  errors: Array<string>,
) {
  let versionsEnqueued = 0

  try {
    console.log(
      '[intent-discover] Searching GitHub for @tanstack/intent dependents...',
    )
    const ghHeaders = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${githubToken}`,
    }

    const searchRes = await fetch(
      'https://api.github.com/search/code?q=%22%40tanstack%2Fintent%22+filename%3Apackage.json&per_page=100',
      { headers: ghHeaders },
    )
    if (!searchRes.ok) {
      throw new Error(`GitHub search ${searchRes.status}`)
    }

    const searchDataJson: unknown = await searchRes.json()
    if (!isGitHubSearchResponse(searchDataJson)) {
      throw new Error('Invalid GitHub search response')
    }

    const seen = new Set<string>()
    const candidates = searchDataJson.items.filter((item) => {
      const key = `${item.repository.full_name}|${item.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(
      `[intent-discover] GitHub found ${candidates.length} package.json files`,
    )

    for (const { path, repo } of candidates.map((item) => ({
      path: item.path,
      repo: item.repository.full_name,
    }))) {
      try {
        const enqueued = await discoverIntentPackageFromGitHubRepo(
          repo,
          path,
          ghHeaders,
        )
        versionsEnqueued += enqueued
      } catch (error) {
        const message = `github/${repo}: ${getErrorMessage(error)}`
        console.error(`[intent-discover] ${message}`)
        errors.push(message)
      }
    }
  } catch (error) {
    console.error(
      '[intent-discover] GitHub path failed:',
      getErrorMessage(error),
    )
  }

  return versionsEnqueued
}

async function discoverIntentPackageFromGitHubRepo(
  repo: string,
  path: string,
  headers: Record<string, string>,
) {
  const contentRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    { headers },
  )
  if (!contentRes.ok) return 0

  const contentDataJson: unknown = await contentRes.json()
  if (!isGitHubContentResponse(contentDataJson)) return 0
  const contentData = contentDataJson
  if (!contentData.content) return 0

  const pkgJson: unknown = JSON.parse(decodeBase64Utf8(contentData.content))
  if (!isPackageJson(pkgJson)) return 0

  const pkgName = pkgJson.name
  if (!pkgName || pkgJson.private) return 0

  const npmRes = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
  )
  if (!npmRes.ok) return 0

  const npmMetaJson: unknown = await npmRes.json()
  if (!isNpmLatestResponse(npmMetaJson)) return 0
  const npmMeta = npmMetaJson
  if (!npmMeta.version || !npmMeta.dist?.tarball) return 0

  const skills = await extractSkillsFromTarball(npmMeta.dist.tarball)
  if (skills.length === 0) return 0

  await upsertIntentPackage({ name: pkgName, verified: true })
  await markPackageVerified(pkgName)

  const packument = await fetchPackument(pkgName)
  const knownVersions = await getKnownVersions(pkgName)
  const toEnqueue = selectVersionsToSync(packument, knownVersions)

  for (const { publishedAt, tarball, version } of toEnqueue) {
    await enqueuePackageVersion({
      packageName: pkgName,
      publishedAt,
      tarballUrl: tarball,
      version,
    })
  }

  if (toEnqueue.length > 0) {
    console.log(
      `[intent-discover] GitHub: ${pkgName} - enqueued ${toEnqueue.length}`,
    )
  }

  return toEnqueue.length
}

async function runIntentQueueProcess(scheduledTime: number) {
  const startTime = Date.now()
  const deadline = startTime + INTENT_PROCESS_BUDGET_MS

  console.log('[intent-process] Starting queue drain...')

  let failed = 0
  let processed = 0
  let skipped = 0

  try {
    const batchSize = 50

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now()
      const pending = await getPendingVersions(batchSize)

      if (pending.length === 0) {
        console.log('[intent-process] Queue empty, nothing to do')
        break
      }

      console.log(
        `[intent-process] ${pending.length} pending version(s), ${Math.round(
          remaining / 1000,
        )}s remaining`,
      )

      for (const item of pending) {
        if (Date.now() >= deadline) {
          skipped += pending.length - pending.indexOf(item)
          console.log(
            `[intent-process] Budget exhausted, stopping. ${skipped} item(s) deferred to next run.`,
          )
          break
        }

        if (!item.tarballUrl) {
          await markVersionFailed(item.id, 'No tarball URL recorded')
          failed++
          continue
        }

        try {
          const skills = await extractSkillsFromTarball(item.tarballUrl)
          await replaceSkillsForVersion(item.id, skills)
          await markVersionSynced(item.id, skills.length)
          processed++
          console.log(
            `[intent-process] ${item.packageName}@${item.version} - ${skills.length} skill(s)`,
          )
        } catch (error) {
          const reason = getErrorMessage(error)
          await markVersionFailed(item.id, reason)
          failed++
          console.error(
            `[intent-process] ${item.packageName}@${item.version}: ${reason}`,
          )
        }
      }

      if (pending.length < batchSize) break
    }

    const duration = Date.now() - startTime
    console.log(
      `[intent-process] Done in ${duration}ms - processed: ${processed}, failed: ${failed}, deferred: ${skipped}`,
    )
    console.log(
      '[intent-process] Scheduled time:',
      new Date(scheduledTime).toISOString(),
    )
  } catch (error) {
    logScheduledError('intent-process', startTime, error)
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGitHubSearchResponse(value: unknown): value is GitHubSearchResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) return false

  return value.items.every((item) => {
    if (!isRecord(item) || typeof item.path !== 'string') return false
    const repository = item.repository
    return isRecord(repository) && typeof repository.full_name === 'string'
  })
}

function isGitHubContentResponse(
  value: unknown,
): value is GitHubContentResponse {
  if (!isRecord(value)) return false
  return value.content === undefined || typeof value.content === 'string'
}

function isPackageJson(value: unknown): value is PackageJson {
  if (!isRecord(value)) return false
  const isNameValid = value.name === undefined || typeof value.name === 'string'
  const isPrivateValid =
    value.private === undefined || typeof value.private === 'boolean'
  return isNameValid && isPrivateValid
}

function isNpmLatestResponse(value: unknown): value is NpmLatestResponse {
  if (!isRecord(value)) return false

  const dist = value.dist
  const isDistValid =
    dist === undefined ||
    (isRecord(dist) &&
      (dist.tarball === undefined || typeof dist.tarball === 'string'))
  const isVersionValid =
    value.version === undefined || typeof value.version === 'string'

  return isDistValid && isVersionValid
}

function logScheduledError(task: string, startTime: number, error: unknown) {
  const duration = Date.now() - startTime
  const errorMessage = getErrorMessage(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  console.error(`[${task}] Failed after ${duration}ms:`, errorMessage)
  if (errorStack) {
    console.error(`[${task}] Stack:`, errorStack)
  }
}
