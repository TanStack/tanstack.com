import { purgeCache } from '@netlify/functions'
import * as Sentry from '@sentry/node'

export type PurgeResult =
  | { purged: true; tags: Array<string> }
  | {
      purged: false
      reason: 'no-tags' | 'no-credentials' | 'error'
      error?: string
    }

export async function purgeNetlifyTags(
  tags: Array<string>,
): Promise<PurgeResult> {
  const uniqueTags = Array.from(new Set(tags)).filter((tag) => tag.length > 0)

  if (uniqueTags.length === 0) {
    return { purged: false, reason: 'no-tags' }
  }

  // SITE_ID + NETLIFY_PURGE_API_TOKEN are auto-injected when running on
  // Netlify. Absent locally — no-op so dev workflows still work.
  if (!process.env.SITE_ID || !process.env.NETLIFY_PURGE_API_TOKEN) {
    return { purged: false, reason: 'no-credentials' }
  }

  try {
    await purgeCache({ tags: uniqueTags })
    return { purged: true, tags: uniqueTags }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[netlify-purge] purgeCache failed', {
      tags: uniqueTags,
      message,
    })
    Sentry.captureException(error, {
      tags: { runtime: 'server', context: 'netlify-purge' },
      extra: { tags: uniqueTags },
    })
    return { purged: false, reason: 'error', error: message }
  }
}
