import { z } from 'zod'
import { getCurrentHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  extractSkillsFromTarball,
  fetchPackument,
  isIntentCompatible,
  searchIntentPackagesPage,
  selectVersionsToSync,
} from '~/utils/intent.server'
import { fetchWithTimeout } from '~/utils/outbound-fetch.server'
import {
  enqueuePackageVersion,
  getKnownVersions,
  getPendingVersions,
  getVersionForProcessing,
  markPackageVerified,
  markVersionFailed,
  markVersionSynced,
  replaceSkillsForVersion,
  upsertIntentPackage,
} from '~/utils/intent-db.server'

const githubSearchResponseSchema = z.object({
  items: z.array(
    z.object({
      path: z.string(),
      repository: z.object({ full_name: z.string() }),
    }),
  ),
})

const githubContentResponseSchema = z.object({
  content: z.string().optional(),
})

const intentGitHubCandidateSchema = z.object({
  repo: z.string(),
  path: z.string(),
})

const packageJsonSchema = z.object({
  name: z.string().optional(),
  private: z.boolean().optional(),
})

const npmLatestSchema = z.object({
  version: z.string().optional(),
  dist: z.object({ tarball: z.string().optional() }).optional(),
})

export const intentDiscoveryResultSchema = z.object({
  packagesDiscovered: z.number().int().nonnegative(),
  githubCandidates: z.number().int().nonnegative(),
  packagesVerified: z.number().int().nonnegative(),
  versionsEnqueued: z.number().int().nonnegative(),
  errors: z.array(z.string()),
})

export const intentVersionProcessResultSchema = z.object({
  packageName: z.string(),
  version: z.string(),
  status: z.enum(['synced', 'failed']),
  skillCount: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
})

export const intentProcessResultSchema = z.object({
  processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  deferred: z.number().int().nonnegative(),
  results: z.array(intentVersionProcessResultSchema),
})

export type IntentDiscoveryResult = z.infer<typeof intentDiscoveryResultSchema>
export type IntentGitHubCandidate = z.infer<typeof intentGitHubCandidateSchema>
export type IntentVersionProcessResult = z.infer<
  typeof intentVersionProcessResultSchema
>
export type IntentProcessResult = z.infer<typeof intentProcessResultSchema>

export interface IntentVersionToProcess {
  id: number
  packageName: string
  version: string
}

export interface IntentSyncOperations {
  searchIntentNpmPackagesPage: (options: {
    from: number
    size: number
  }) => Promise<{ packageNames: Array<string>; total: number }>
  discoverIntentNpmPackage: (packageName: string) => Promise<number | null>
  searchIntentGitHubCandidates: () => Promise<Array<IntentGitHubCandidate>>
  discoverIntentGitHubPackage: (
    candidate: IntentGitHubCandidate,
  ) => Promise<number | null>
  selectPendingIntentVersions: (options: {
    limit: number
    excludeIds?: Array<number>
  }) => Promise<Array<IntentVersionToProcess>>
  processIntentVersion: (
    versionId: number,
  ) => Promise<IntentVersionProcessResult>
}

export const defaultIntentSyncOperations: IntentSyncOperations = {
  searchIntentNpmPackagesPage,
  discoverIntentNpmPackage,
  searchIntentGitHubCandidates,
  discoverIntentGitHubPackage,
  selectPendingIntentVersions,
  processIntentVersion,
}

export async function searchIntentNpmPackagesPage(options: {
  from: number
  size: number
}) {
  const page = await searchIntentPackagesPage(options)
  return {
    packageNames: page.objects.map((item) => item.package.name),
    total: page.total,
  }
}

export async function selectPendingIntentVersions(options: {
  limit: number
  excludeIds?: Array<number>
}): Promise<Array<IntentVersionToProcess>> {
  const versions = await getPendingVersions(options.limit, {
    excludeIds: options.excludeIds,
  })

  return versions.map((version) => ({
    id: version.id,
    packageName: version.packageName,
    version: version.version,
  }))
}

export function summarizeIntentProcessResults(
  results: Array<IntentVersionProcessResult>,
  options?: { deferred?: number },
): IntentProcessResult {
  return {
    processed: results.filter((result) => result.status === 'synced').length,
    failed: results.filter((result) => result.status === 'failed').length,
    deferred: options?.deferred ?? 0,
    results,
  }
}

export async function discoverIntentNpmPackage(
  packageName: string,
): Promise<number | null> {
  await upsertIntentPackage({ name: packageName, verified: false })

  const packument = await fetchPackument(packageName)
  const latestVersion = packument['dist-tags'].latest
  const latestMeta = latestVersion ? packument.versions[latestVersion] : null
  if (!latestVersion || !latestMeta || !isIntentCompatible(latestMeta)) {
    return null
  }

  await markPackageVerified(packageName)
  return enqueueVersionsFromPackument(packageName, packument)
}

export async function searchIntentGitHubCandidates() {
  const githubToken = getGitHubToken()
  if (!githubToken) return []

  const ghHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  }
  const searchRes = await fetchWithTimeout(
    'https://api.github.com/search/code?q=%22%40tanstack%2Fintent%22+filename%3Apackage.json&per_page=100',
    { headers: ghHeaders, timeoutMs: 10_000 },
  )
  if (!searchRes.ok) throw new Error(`GitHub search ${searchRes.status}`)

  const searchData = githubSearchResponseSchema.parse(await searchRes.json())
  const candidates = dedupeBy(
    searchData.items.map((item) => ({
      repo: item.repository.full_name,
      path: item.path,
    })),
    (item) => `${item.repo}|${item.path}`,
  )
  return candidates
}

export async function discoverIntentGitHubPackage(
  candidate: IntentGitHubCandidate,
): Promise<number | null> {
  const githubToken = getGitHubToken()
  if (!githubToken) return null

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  }
  const contentRes = await fetchWithTimeout(
    `https://api.github.com/repos/${candidate.repo}/contents/${candidate.path}`,
    { headers, timeoutMs: 10_000 },
  )
  if (!contentRes.ok) return null

  const contentData = githubContentResponseSchema.parse(await contentRes.json())
  if (!contentData.content) return null

  const packageJson = packageJsonSchema.parse(
    JSON.parse(Buffer.from(contentData.content, 'base64').toString('utf-8')),
  )
  if (!packageJson.name || packageJson.private) return null

  const npmRes = await fetchWithTimeout(
    `https://registry.npmjs.org/${encodeURIComponent(packageJson.name)}/latest`,
    { timeoutMs: 10_000 },
  )
  if (!npmRes.ok) return null

  const npmMeta = npmLatestSchema.parse(await npmRes.json())
  if (!npmMeta.dist?.tarball) return null

  const skills = await extractSkillsFromTarball(npmMeta.dist.tarball)
  if (skills.length === 0) return null

  await upsertIntentPackage({ name: packageJson.name, verified: true })
  await markPackageVerified(packageJson.name)

  const packument = await fetchPackument(packageJson.name)
  return enqueueVersionsFromPackument(packageJson.name, packument)
}

async function enqueueVersionsFromPackument(
  packageName: string,
  packument: Awaited<ReturnType<typeof fetchPackument>>,
): Promise<number> {
  const knownVersions = await getKnownVersions(packageName)
  const versionsToEnqueue = selectVersionsToSync(packument, knownVersions)

  for (const version of versionsToEnqueue) {
    await enqueuePackageVersion({
      packageName,
      version: version.version,
      tarballUrl: version.tarball,
      publishedAt: version.publishedAt,
    })
  }

  return versionsToEnqueue.length
}

export async function processIntentVersion(
  versionId: number,
): Promise<IntentVersionProcessResult> {
  const version = await getVersionForProcessing(versionId)
  if (!version) {
    throw new Error(`Intent package version ${versionId} not found`)
  }

  if (version.syncStatus === 'synced') {
    return {
      packageName: version.packageName,
      version: version.version,
      status: 'synced',
      skillCount: version.skillCount,
    }
  }

  if (!version.tarballUrl) {
    const reason = 'No tarball URL recorded'
    await markVersionFailed(version.id, reason)
    return {
      packageName: version.packageName,
      version: version.version,
      status: 'failed',
      error: reason,
    }
  }

  try {
    const skills = await extractSkillsFromTarball(version.tarballUrl)
    await replaceSkillsForVersion(version.id, skills)
    await markVersionSynced(version.id, skills.length)
    return {
      packageName: version.packageName,
      version: version.version,
      status: 'synced',
      skillCount: skills.length,
    }
  } catch (error) {
    const reason = getErrorMessage(error)
    await markVersionFailed(version.id, reason)
    return {
      packageName: version.packageName,
      version: version.version,
      status: 'failed',
      error: reason,
    }
  }
}

function getGitHubToken() {
  return (
    getCurrentHostRuntimeEnv()?.GITHUB_AUTH_TOKEN ??
    process.env.GITHUB_AUTH_TOKEN
  )
}

function dedupeBy<T>(values: Array<T>, getKey: (value: T) => string): Array<T> {
  const seen = new Set<string>()
  const result: Array<T> = []
  for (const value of values) {
    const key = getKey(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
