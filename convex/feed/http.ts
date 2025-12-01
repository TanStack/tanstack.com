import { httpAction } from '../_generated/server'
import { api } from '../_generated/api'
import { normalizeGitHubRelease } from './github'

export const handleGitHubWebhook = httpAction(async (ctx, request) => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
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

  // Verify signature using Node.js action
  const isValid = await ctx.runAction(api.feed.crypto.verifyGitHubSignature, {
    payload,
    signature,
    secret: webhookSecret,
  })

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
  const normalized = normalizeGitHubRelease({
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
  const existing = await ctx.runQuery(api.feed.queries.getFeedEntry, {
    id: normalized.id,
  })

  if (existing) {
    // Update existing entry
    await ctx.runMutation(api.feed.mutations.updateFeedEntry, {
      id: normalized.id,
      title: normalized.title,
      content: normalized.content,
      excerpt: normalized.excerpt,
      publishedAt: normalized.publishedAt,
      metadata: normalized.metadata,
      libraryIds: normalized.libraryIds,
      tags: normalized.tags,
      lastSyncedAt: now,
    })
  } else {
    // Create new entry
    await ctx.runMutation(api.feed.mutations.createFeedEntry, {
      ...normalized,
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
})
