import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  docsArtifactCache,
  githubContentCache,
  type GithubContentCache,
} from '~/db/schema'

const POSITIVE_STALE_MS = 24 * 60 * 60 * 1000
const NEGATIVE_STALE_MS = 15 * 60 * 1000

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

function queueRefresh(key: string, fn: () => Promise<unknown>) {
  void withPendingRefresh(key, fn).catch((error) => {
    console.error(`[GitHub Cache] Failed to refresh ${key}:`, error)
  })
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

  if (storedValue !== undefined) {
    if (cachedRow && isFresh(cachedRow.staleAt)) {
      return storedValue
    }

    if (storedValue !== null) {
      queueRefresh(opts.cacheKey, async () => {
        const value = await opts.origin()
        await persist(value)
      })

      return storedValue
    }
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

  if (storedValue !== undefined) {
    if (cachedRow && isFresh(cachedRow.staleAt)) {
      return storedValue
    }

    queueRefresh(cacheKey, async () => {
      const payload = await opts.build()
      await upsertDocsArtifact({ ...opts, payload })
    })

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

  const updateData = {
    staleAt: new Date(0),
    updatedAt: new Date(),
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

  const updateData = {
    staleAt: new Date(0),
    updatedAt: new Date(),
  }

  if (whereClause) {
    await db.update(docsArtifactCache).set(updateData).where(whereClause)
  } else {
    await db.update(docsArtifactCache).set(updateData)
  }

  return rowCount
}
