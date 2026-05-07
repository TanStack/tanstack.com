import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  docsArtifactCache,
  githubContentCache,
  type GithubContentCache,
} from '~/db/schema'

const POSITIVE_STALE_MS = 24 * 60 * 60 * 1000
const NEGATIVE_STALE_MS = 15 * 60 * 1000

// Internal sentinel paths used for non-file metadata (branch SHA lookup,
// recursive tree). Allowed alongside normal repo paths.
const SENTINEL_PATHS = new Set([
  '__github_branch__',
  '__github_recursive_tree__',
])

const REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/
// Git refs allow a fairly wide character set, but we restrict to the subset
// we actually publish from (branch names + tags). No spaces, no shell
// metacharacters, no path traversal.
const GIT_REF_PATTERN = /^[a-zA-Z0-9._/-]+$/
const PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/

const MAX_REPO_LEN = 100
const MAX_GIT_REF_LEN = 100
const MAX_PATH_LEN = 512

export class InvalidCacheKeyError extends Error {
  constructor(field: string, value: string) {
    super(
      `Refusing to cache: invalid ${field}=${JSON.stringify(value).slice(0, 80)}`,
    )
    this.name = 'InvalidCacheKeyError'
  }
}

function assertValidRepo(repo: string) {
  if (
    repo.length === 0 ||
    repo.length > MAX_REPO_LEN ||
    !REPO_PATTERN.test(repo)
  ) {
    throw new InvalidCacheKeyError('repo', repo)
  }
}

function assertValidGitRef(gitRef: string) {
  if (
    gitRef.length === 0 ||
    gitRef.length > MAX_GIT_REF_LEN ||
    !GIT_REF_PATTERN.test(gitRef) ||
    gitRef.includes('..') ||
    gitRef.startsWith('/') ||
    gitRef.endsWith('/') ||
    gitRef.includes('//')
  ) {
    throw new InvalidCacheKeyError('gitRef', gitRef)
  }
}

function assertValidContentPath(path: string) {
  if (path === '' || SENTINEL_PATHS.has(path)) {
    return
  }

  if (path.length > MAX_PATH_LEN) {
    throw new InvalidCacheKeyError('path', path)
  }

  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('//') ||
    path.includes('..')
  ) {
    throw new InvalidCacheKeyError('path', path)
  }

  for (const segment of path.split('/')) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
      throw new InvalidCacheKeyError('path', path)
    }
  }
}

function assertValidCacheKey(opts: {
  gitRef: string
  path: string
  repo: string
}) {
  assertValidRepo(opts.repo)
  assertValidGitRef(opts.gitRef)
  assertValidContentPath(opts.path)
}

const pendingRefreshes = new Map<string, Promise<unknown>>()

type CachedValue<T> = T | null | undefined

function withPendingRefresh<T>(key: string, fn: () => Promise<T>) {
  const pending = pendingRefreshes.get(key)

  if (pending) {
    return pending as Promise<T>
  }

  const promise = fn().finally(() => {
    pendingRefreshes.delete(key)
  })

  pendingRefreshes.set(key, promise)

  return promise
}

function createFreshnessWindow(isPresent: boolean) {
  const now = Date.now()
  const staleFor = isPresent ? POSITIVE_STALE_MS : NEGATIVE_STALE_MS

  return {
    staleAt: new Date(now + staleFor),
  }
}

function isFresh(staleAt: Date) {
  return staleAt.getTime() > Date.now()
}

function readStoredTextValue(row: GithubContentCache | undefined) {
  if (!row) {
    return undefined
  }

  if (!row.isPresent) {
    return null
  }

  return typeof row.textContent === 'string' ? row.textContent : undefined
}

function readStoredJsonValue<T>(
  row: GithubContentCache | undefined,
  isValue: (value: unknown) => value is T,
) {
  if (!row) {
    return undefined
  }

  if (!row.isPresent) {
    return null
  }

  return isValue(row.jsonContent) ? row.jsonContent : undefined
}

async function findGithubContentRow(opts: {
  contentKind: 'dir' | 'file'
  gitRef: string
  path: string
  repo: string
}) {
  return db.query.githubContentCache.findFirst({
    where: and(
      eq(githubContentCache.repo, opts.repo),
      eq(githubContentCache.gitRef, opts.gitRef),
      eq(githubContentCache.contentKind, opts.contentKind),
      eq(githubContentCache.path, opts.path),
    ),
  })
}

async function upsertGithubContent(opts: {
  contentKind: 'dir' | 'file'
  gitRef: string
  path: string
  repo: string
  value: string | unknown | null
}) {
  const now = new Date()
  const isPresent = opts.value !== null
  const freshness = createFreshnessWindow(isPresent)

  await db
    .insert(githubContentCache)
    .values({
      repo: opts.repo,
      gitRef: opts.gitRef,
      contentKind: opts.contentKind,
      path: opts.path,
      isPresent,
      textContent:
        opts.contentKind === 'file' && typeof opts.value === 'string'
          ? opts.value
          : null,
      jsonContent: opts.contentKind === 'dir' ? opts.value : null,
      staleAt: freshness.staleAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        githubContentCache.repo,
        githubContentCache.gitRef,
        githubContentCache.contentKind,
        githubContentCache.path,
      ],
      set: {
        isPresent,
        textContent:
          opts.contentKind === 'file' && typeof opts.value === 'string'
            ? opts.value
            : null,
        jsonContent: opts.contentKind === 'dir' ? opts.value : null,
        staleAt: freshness.staleAt,
        updatedAt: now,
      },
    })
}

async function getCachedGitHubContent<T>(opts: {
  cacheKey: string
  contentKind: 'dir' | 'file'
  gitRef: string
  origin: () => Promise<T | null>
  path: string
  readStoredValue: (row: GithubContentCache | undefined) => CachedValue<T>
  repo: string
}) {
  assertValidCacheKey(opts)

  const readRow = () =>
    findGithubContentRow({
      repo: opts.repo,
      gitRef: opts.gitRef,
      contentKind: opts.contentKind,
      path: opts.path,
    })
  const persist = (value: T | null) =>
    upsertGithubContent({
      repo: opts.repo,
      gitRef: opts.gitRef,
      contentKind: opts.contentKind,
      path: opts.path,
      value,
    })

  const cachedRow = await readRow()
  const storedValue = opts.readStoredValue(cachedRow)

  if (storedValue !== undefined && cachedRow && isFresh(cachedRow.staleAt)) {
    return storedValue
  }

  return withPendingRefresh(opts.cacheKey, async () => {
    const latestRow = await readRow()
    const latestValue = opts.readStoredValue(latestRow)

    if (latestValue !== undefined && latestRow && isFresh(latestRow.staleAt)) {
      return latestValue
    }

    try {
      const value = await opts.origin()
      await persist(value)
      return value
    } catch (error) {
      if (latestValue !== undefined && latestValue !== null) {
        console.warn(`[GitHub Cache] Serving stale value ${opts.cacheKey}`)
        return latestValue
      }

      throw error
    }
  })
}

async function upsertDocsArtifact(opts: {
  artifactKey: string
  artifactType: string
  docsRoot: string
  gitRef: string
  payload: unknown
  repo: string
}) {
  const now = new Date()
  const freshness = createFreshnessWindow(true)

  await db
    .insert(docsArtifactCache)
    .values({
      repo: opts.repo,
      gitRef: opts.gitRef,
      docsRoot: opts.docsRoot,
      artifactType: opts.artifactType,
      artifactKey: opts.artifactKey,
      payload: opts.payload,
      staleAt: freshness.staleAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        docsArtifactCache.repo,
        docsArtifactCache.gitRef,
        docsArtifactCache.docsRoot,
        docsArtifactCache.artifactType,
        docsArtifactCache.artifactKey,
      ],
      set: {
        payload: opts.payload,
        staleAt: freshness.staleAt,
        updatedAt: now,
      },
    })
}

export async function getCachedGitHubTextFile(opts: {
  gitRef: string
  origin: () => Promise<string | null>
  path: string
  repo: string
}) {
  return getCachedGitHubContent({
    ...opts,
    cacheKey: `github:file:${opts.repo}:${opts.gitRef}:${opts.path}`,
    contentKind: 'file',
    readStoredValue: readStoredTextValue,
  })
}

export async function getCachedGitHubJsonContent<T>(opts: {
  gitRef: string
  isValue: (value: unknown) => value is T
  origin: () => Promise<T | null>
  path: string
  repo: string
}) {
  return getCachedGitHubContent({
    ...opts,
    cacheKey: `github:dir:${opts.repo}:${opts.gitRef}:${opts.path}`,
    contentKind: 'dir',
    readStoredValue: (row) => readStoredJsonValue(row, opts.isValue),
  })
}

export async function getCachedDocsArtifact<T>(opts: {
  artifactKey: string
  artifactType: string
  build: () => Promise<T>
  docsRoot: string
  gitRef: string
  isValue: (value: unknown) => value is T
  repo: string
}) {
  assertValidRepo(opts.repo)
  assertValidGitRef(opts.gitRef)
  assertValidContentPath(opts.docsRoot)

  const cacheKey = `docs-artifact:${opts.repo}:${opts.gitRef}:${opts.docsRoot}:${opts.artifactType}:${opts.artifactKey}`
  const readRow = () =>
    db.query.docsArtifactCache.findFirst({
      where: and(
        eq(docsArtifactCache.repo, opts.repo),
        eq(docsArtifactCache.gitRef, opts.gitRef),
        eq(docsArtifactCache.docsRoot, opts.docsRoot),
        eq(docsArtifactCache.artifactType, opts.artifactType),
        eq(docsArtifactCache.artifactKey, opts.artifactKey),
      ),
    })

  const cachedRow = await readRow()
  const storedValue =
    cachedRow && opts.isValue(cachedRow.payload) ? cachedRow.payload : undefined

  if (storedValue !== undefined && cachedRow && isFresh(cachedRow.staleAt)) {
    return storedValue
  }

  return withPendingRefresh(cacheKey, async () => {
    const latestRow = await readRow()
    const latestValue =
      latestRow && opts.isValue(latestRow.payload)
        ? latestRow.payload
        : undefined

    if (latestValue !== undefined && latestRow && isFresh(latestRow.staleAt)) {
      return latestValue
    }

    try {
      const payload = await opts.build()
      await upsertDocsArtifact({ ...opts, payload })
      return payload
    } catch (error) {
      if (latestValue !== undefined) {
        console.warn(`[GitHub Cache] Serving stale artifact ${cacheKey}`)
        return latestValue
      }

      throw error
    }
  })
}

const DEFAULT_PRUNE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
// Negative cache rows (404s) only need to live long enough to absorb a
// short burst of repeated requests for a missing path. After that they're
// pure bloat — every scraper, broken backlink, and probe leaves a row.
const DEFAULT_NEGATIVE_PRUNE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function pruneStaleCacheRows(
  opts: {
    maxAgeMs?: number
    negativeMaxAgeMs?: number
  } = {},
) {
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_PRUNE_MAX_AGE_MS
  const negativeMaxAgeMs =
    opts.negativeMaxAgeMs ?? DEFAULT_NEGATIVE_PRUNE_MAX_AGE_MS
  const cutoff = new Date(Date.now() - maxAgeMs)
  const negativeCutoff = new Date(Date.now() - negativeMaxAgeMs)

  const [contentByAge, contentNegatives, artifactDeleted] = await Promise.all([
    db
      .delete(githubContentCache)
      .where(lt(githubContentCache.updatedAt, cutoff))
      .returning({ id: githubContentCache.id }),
    db
      .delete(githubContentCache)
      .where(
        and(
          eq(githubContentCache.isPresent, false),
          lt(githubContentCache.updatedAt, negativeCutoff),
        ),
      )
      .returning({ id: githubContentCache.id }),
    db
      .delete(docsArtifactCache)
      .where(lt(docsArtifactCache.updatedAt, cutoff))
      .returning({ id: docsArtifactCache.id }),
  ])

  return {
    cutoff,
    negativeCutoff,
    githubContentDeleted: contentByAge.length + contentNegatives.length,
    githubContentNegativesDeleted: contentNegatives.length,
    docsArtifactDeleted: artifactDeleted.length,
  }
}

export async function markGitHubContentStale(
  opts: {
    gitRef?: string
    repo?: string
  } = {},
) {
  const whereConditions = []

  if (opts.repo) {
    whereConditions.push(eq(githubContentCache.repo, opts.repo))
  }

  if (opts.gitRef) {
    whereConditions.push(eq(githubContentCache.gitRef, opts.gitRef))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined
  const [countRow] = whereClause
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(githubContentCache)
        .where(whereClause)
    : await db
        .select({ count: sql<number>`count(*)::int` })
        .from(githubContentCache)
  const rowCount = countRow?.count ?? 0

  if (rowCount === 0) {
    return 0
  }

  // Only set staleAt — do NOT bump updatedAt. updatedAt tracks last
  // upsert (i.e. last access/refresh) and is the signal our GC uses to
  // decide what to prune. Bumping it here would mask every cached row
  // as "freshly used" on every webhook invalidation.
  const updateData = {
    staleAt: new Date(0),
  }

  if (whereClause) {
    await db.update(githubContentCache).set(updateData).where(whereClause)
  } else {
    await db.update(githubContentCache).set(updateData)
  }

  return rowCount
}

export async function pruneOldCacheEntries(olderThanMs: number) {
  const threshold = new Date(Date.now() - olderThanMs)

  const [contentDeleted, artifactDeleted] = await Promise.all([
    db
      .delete(githubContentCache)
      .where(lt(githubContentCache.updatedAt, threshold))
      .returning({ repo: githubContentCache.repo }),
    db
      .delete(docsArtifactCache)
      .where(lt(docsArtifactCache.updatedAt, threshold))
      .returning({ repo: docsArtifactCache.repo }),
  ])

  return {
    contentDeleted: contentDeleted.length,
    artifactDeleted: artifactDeleted.length,
    threshold,
  }
}

export async function markDocsArtifactsStale(
  opts: {
    gitRef?: string
    repo?: string
  } = {},
) {
  const whereConditions = []

  if (opts.repo) {
    whereConditions.push(eq(docsArtifactCache.repo, opts.repo))
  }

  if (opts.gitRef) {
    whereConditions.push(eq(docsArtifactCache.gitRef, opts.gitRef))
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined
  const [countRow] = whereClause
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(docsArtifactCache)
        .where(whereClause)
    : await db
        .select({ count: sql<number>`count(*)::int` })
        .from(docsArtifactCache)
  const rowCount = countRow?.count ?? 0

  if (rowCount === 0) {
    return 0
  }

  // Only set staleAt — do NOT bump updatedAt. updatedAt tracks last
  // upsert (i.e. last access/refresh) and is the signal our GC uses to
  // decide what to prune. Bumping it here would mask every cached row
  // as "freshly used" on every webhook invalidation.
  const updateData = {
    staleAt: new Date(0),
  }

  if (whereClause) {
    await db.update(docsArtifactCache).set(updateData).where(whereClause)
  } else {
    await db.update(docsArtifactCache).set(updateData)
  }

  return rowCount
}
