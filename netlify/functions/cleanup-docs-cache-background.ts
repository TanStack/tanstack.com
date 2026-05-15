import type { Config } from '@netlify/functions'
import { pruneOldCacheEntries } from '~/utils/github-content-cache.server'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const handler = async (req: Request) => {
  const { next_run } = await req.json()

  console.log('[cleanup-docs-cache] Starting docs cache prune...')

  const startTime = Date.now()

  try {
    const { contentDeleted, artifactDeleted, threshold } =
      await pruneOldCacheEntries(THIRTY_DAYS_MS)

    const duration = Date.now() - startTime
    console.log(
      `[cleanup-docs-cache] Completed in ${duration}ms - Deleted ${contentDeleted.toLocaleString()} content rows and ${artifactDeleted.toLocaleString()} artifact rows older than ${threshold.toISOString()}`,
    )
    console.log('[cleanup-docs-cache] Next invocation at:', next_run)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(
      `[cleanup-docs-cache] Failed after ${duration}ms:`,
      errorMessage,
    )
    if (errorStack) {
      console.error('[cleanup-docs-cache] Stack:', errorStack)
    }
  }
}

export default handler

export const config: Config = {
  schedule: '0 3 * * *',
}
