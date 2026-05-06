import type { Config } from '@netlify/functions'
import { pruneStaleCacheRows } from '~/utils/github-content-cache.server'

/**
 * Netlify Scheduled Function - Prune stale GitHub content cache rows
 *
 * Deletes rows in `github_content_cache` and `docs_artifact_cache` whose
 * `updatedAt` is older than the configured TTL. Anything that's still being
 * read regularly is touched on refresh and stays put; the rest (old gitRefs,
 * deleted paths, abandoned branches) gets reclaimed.
 *
 * Scheduled: Daily at 09:00 UTC.
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()

  const startTime = Date.now()
  console.log('[prune-content-cache] Starting prune...')

  try {
    const result = await pruneStaleCacheRows()
    const duration = Date.now() - startTime

    console.log(
      `[prune-content-cache] ✓ Completed in ${duration}ms - deleted ${result.githubContentDeleted} content rows (${result.githubContentNegativesDeleted} negatives), ${result.docsArtifactDeleted} artifact rows (cutoff: ${result.cutoff.toISOString()}, negativeCutoff: ${result.negativeCutoff.toISOString()})`,
    )
    console.log('[prune-content-cache] Next invocation at:', next_run)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[prune-content-cache] ✗ Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[prune-content-cache] Stack:', errorStack)
    }
  }
}

export default handler

export const config: Config = {
  schedule: '0 9 * * *', // Daily at 09:00 UTC
}
