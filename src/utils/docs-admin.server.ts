import { sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { docsArtifactCache, githubContentCache } from '~/db/schema'
import { docsWebhookSources } from '~/utils/docs-webhook-sources'
import { requireCapability } from './auth.server'
import {
  markDocsArtifactsStale,
  markGitHubContentStale,
} from './github-content-cache.server'

function normalizeDateValue(value: Date | number | string | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getLatestDate(
  ...dates: Array<Date | number | string | null | undefined>
) {
  let latest: Date | null = null

  for (const dateValue of dates) {
    const date = normalizeDateValue(dateValue)

    if (!date) {
      continue
    }

    if (!latest || date.getTime() > latest.getTime()) {
      latest = date
    }
  }

  return latest
}

export async function listDocsCacheReposAdmin() {
  await requireCapability({ data: { capability: 'admin' } })

  const [contentRows, artifactRows] = await Promise.all([
    db
      .select({
        repo: githubContentCache.repo,
        entryCount: sql<number>`count(*)::int`.as('entry_count'),
        refCount:
          sql<number>`count(distinct ${githubContentCache.gitRef})::int`.as(
            'ref_count',
          ),
        staleEntryCount:
          sql<number>`count(*) filter (where ${githubContentCache.staleAt} <= now())::int`.as(
            'stale_entry_count',
          ),
        lastUpdatedAt:
          sql<Date | null>`max(${githubContentCache.updatedAt})`.as(
            'last_updated_at',
          ),
      })
      .from(githubContentCache)
      .groupBy(githubContentCache.repo),
    db
      .select({
        repo: docsArtifactCache.repo,
        entryCount: sql<number>`count(*)::int`.as('entry_count'),
        refCount:
          sql<number>`count(distinct ${docsArtifactCache.gitRef})::int`.as(
            'ref_count',
          ),
        staleEntryCount:
          sql<number>`count(*) filter (where ${docsArtifactCache.staleAt} <= now())::int`.as(
            'stale_entry_count',
          ),
        lastUpdatedAt: sql<Date | null>`max(${docsArtifactCache.updatedAt})`.as(
          'last_updated_at',
        ),
      })
      .from(docsArtifactCache)
      .groupBy(docsArtifactCache.repo),
  ])

  const watchedRefsByRepo = new Map(
    docsWebhookSources.map((source) => [source.repo, source.refs]),
  )
  const contentByRepo = new Map(contentRows.map((row) => [row.repo, row]))
  const artifactByRepo = new Map(artifactRows.map((row) => [row.repo, row]))
  const repoNames = new Set<string>()

  for (const repo of watchedRefsByRepo.keys()) {
    repoNames.add(repo)
  }

  for (const repo of contentByRepo.keys()) {
    repoNames.add(repo)
  }

  for (const repo of artifactByRepo.keys()) {
    repoNames.add(repo)
  }

  const repos = Array.from(repoNames)
    .map((repo) => {
      const content = contentByRepo.get(repo)
      const artifact = artifactByRepo.get(repo)
      const refs = watchedRefsByRepo.get(repo) ?? []
      const contentEntries = content?.entryCount ?? 0
      const artifactEntries = artifact?.entryCount ?? 0
      const staleContentEntries = content?.staleEntryCount ?? 0
      const staleArtifactEntries = artifact?.staleEntryCount ?? 0

      return {
        repo,
        refs,
        isWatched: watchedRefsByRepo.has(repo),
        contentEntries,
        artifactEntries,
        staleContentEntries,
        staleArtifactEntries,
        totalEntries: contentEntries + artifactEntries,
        staleEntries: staleContentEntries + staleArtifactEntries,
        cachedRefCount: Math.max(
          content?.refCount ?? 0,
          artifact?.refCount ?? 0,
        ),
        lastUpdatedAt:
          getLatestDate(
            content?.lastUpdatedAt ?? null,
            artifact?.lastUpdatedAt ?? null,
          )?.toISOString() ?? null,
      }
    })
    .sort(
      (a, b) => b.totalEntries - a.totalEntries || a.repo.localeCompare(b.repo),
    )

  return {
    repos,
    summary: {
      watchedRepoCount: docsWebhookSources.length,
      cachedRepoCount: repos.filter((repo) => repo.totalEntries > 0).length,
      contentEntries: repos.reduce(
        (total, repo) => total + repo.contentEntries,
        0,
      ),
      artifactEntries: repos.reduce(
        (total, repo) => total + repo.artifactEntries,
        0,
      ),
      staleEntries: repos.reduce((total, repo) => total + repo.staleEntries, 0),
      totalEntries: repos.reduce((total, repo) => total + repo.totalEntries, 0),
    },
  }
}

export async function invalidateDocsCacheAdmin(opts: {
  data: {
    repo?: string
  }
}) {
  await requireCapability({ data: { capability: 'admin' } })

  const [staleContentCount, staleArtifactCount] = await Promise.all([
    markGitHubContentStale({ repo: opts.data.repo }),
    markDocsArtifactsStale({ repo: opts.data.repo }),
  ])

  return {
    repo: opts.data.repo ?? null,
    staleContentCount,
    staleArtifactCount,
    totalInvalidated: staleContentCount + staleArtifactCount,
  }
}
