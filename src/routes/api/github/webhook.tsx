import { createFileRoute } from '@tanstack/react-router'
import { normalizeGitHubRelease } from '~/server/feed/github'
import { getFeedEntry, createFeedEntry, updateFeedEntry } from '~/utils/feed.functions'
import { env } from '~/utils/env'
import crypto from 'crypto'

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

export const Route = createFileRoute('/api/github/webhook')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const webhookSecret = env.GITHUB_WEBHOOK_SECRET
        if (!webhookSecret) {
          return new Response(
            JSON.stringify({ error: 'Webhook secret not configured' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        // Get signature from headers
        const signature = request.headers.get('X-Hub-Signature-256')
        if (!signature) {
          return new Response(JSON.stringify({ error: 'Missing signature' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Read request body
        const payload = await request.text()

        // Verify signature
        const isValid = verifyGitHubSignature(payload, signature, webhookSecret)
        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Parse payload
        const event = JSON.parse(payload)
        const eventType = request.headers.get('X-GitHub-Event')

        // Only process release events
        if (eventType !== 'release' || event.action !== 'published') {
          return new Response(
            JSON.stringify({
              message: 'Event ignored',
              eventType,
              action: event.action,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        // Extract repo from event
        const repo = event.repository.full_name

        // Normalize release
        const normalized = await normalizeGitHubRelease({
          id: event.release.id,
          tag_name: event.release.tag_name,
          name: event.release.name,
          body: event.release.body || '',
          published_at: event.release.published_at,
          html_url: event.release.html_url,
          author: event.release.author,
          repo,
        })

        const now = Date.now()

        // Check if entry already exists
        const existing = await getFeedEntry({ data: { id: normalized.id } })

        if (existing) {
          // Update existing entry
          await updateFeedEntry({
            data: {
              id: normalized.id,
              title: normalized.title,
              content: normalized.content,
              excerpt: normalized.excerpt,
              publishedAt: normalized.publishedAt,
              metadata: normalized.metadata,
              libraryIds: normalized.libraryIds,
              tags: normalized.tags,
              lastSyncedAt: now,
            },
          })
        } else {
          // Create new entry
          await createFeedEntry({
            data: normalized,
          })
        }

        return new Response(
          JSON.stringify({
            message: 'Webhook processed',
            releaseId: normalized.id,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      },
    },
  },
})

