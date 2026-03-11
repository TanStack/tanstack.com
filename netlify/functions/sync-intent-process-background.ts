import type { Config } from '@netlify/functions'
import { extractSkillsFromTarball } from '~/utils/intent.server'
import {
  getPendingVersions,
  replaceSkillsForVersion,
  markVersionSynced,
  markVersionFailed,
} from '~/utils/intent-db.server'

// Hard budget: stop processing with this much time remaining before the
// 15-minute Netlify background function limit. Each tarball can take 1-5s,
// so 3 minutes of headroom is sufficient.
const BUDGET_MS = 12 * 60 * 1000 // 12 minutes

/**
 * Netlify Scheduled Function - Process pending Intent skill extractions
 *
 * Phase 2 of 2. Drains the pending version queue populated by
 * sync-intent-discover-background. Runs more frequently so new packages
 * appear in the registry quickly.
 *
 * Durability: each version is atomically marked 'synced' or 'failed' in the
 * DB immediately after processing. A timeout or crash loses at most the
 * single in-flight version (which stays 'pending' and is retried next run).
 * Failed versions are retried every cycle until they succeed.
 *
 * Scheduled: Every 15 minutes
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()
  const startTime = Date.now()
  const deadline = startTime + BUDGET_MS

  console.log('[intent-process] Starting queue drain...')

  let processed = 0
  let failed = 0
  let skipped = 0

  try {
    // Fetch enough pending items to keep us busy, but not so many we hold
    // a huge result set in memory. We'll loop until time runs out.
    const BATCH_SIZE = 50

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now()
      const pending = await getPendingVersions(BATCH_SIZE)

      if (pending.length === 0) {
        console.log('[intent-process] Queue empty, nothing to do')
        break
      }

      console.log(
        `[intent-process] ${pending.length} pending version(s), ${Math.round(remaining / 1000)}s remaining`,
      )

      for (const item of pending) {
        // Check budget before each item, not just at batch boundaries
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
            `[intent-process] ✓ ${item.packageName}@${item.version} - ${skills.length} skill(s)`,
          )
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err)
          await markVersionFailed(item.id, reason)
          failed++
          console.error(
            `[intent-process] ✗ ${item.packageName}@${item.version}: ${reason}`,
          )
        }
      }

      // If we got fewer items than the batch size, the queue is drained
      if (pending.length < BATCH_SIZE) break
    }

    const duration = Date.now() - startTime
    console.log(
      `[intent-process] Done in ${duration}ms - processed: ${processed}, failed: ${failed}, deferred: ${skipped}`,
    )
    console.log('[intent-process] Next invocation at:', next_run)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(
      `[intent-process] Fatal error after ${duration}ms:`,
      error instanceof Error ? error.message : String(error),
    )
    if (error instanceof Error && error.stack) {
      console.error('[intent-process] Stack:', error.stack)
    }
  }
}

export default handler

export const config: Config = {
  schedule: '*/15 * * * *', // Every 15 minutes
}
