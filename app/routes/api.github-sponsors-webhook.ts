import crypto from 'node:crypto'
import type { ActionFunction } from '@remix-run/node'

import {
  sponsorCreated,
  sponsorCancelled,
  sponsorEdited,
} from '~/server/sponsors'

async function verifySecret(req: Request) {
  const sig = req.headers.get('x-hub-signature') || ''
  const hmac = crypto.createHmac(
    'sha1',
    process.env.GITHUB_SPONSORS_WEBHOOK_SECRET as any
  )
  const digest = Buffer.from(
    'sha1=' + hmac.update(JSON.stringify(req.body)).digest('hex'),
    'utf8'
  )
  const checksum = Buffer.from(sig, 'utf8')
  if (
    checksum.length !== digest.length ||
    !crypto.timingSafeEqual(digest, checksum)
  ) {
    throw new Error(
      `Request body digest (${digest}) did not match x-hub-signature (${checksum})`
    )
  }
}

export const action: ActionFunction = async (ctx) => {
  await verifySecret(ctx.request)

  const githubEvent = ctx.request.headers.get('x-github-event')
  const id = ctx.request.headers.get('x-github-delivery')

  if (!githubEvent) {
    throw new Response('No X-Github-Event found on request', {
      status: 400,
    })
  }

  if (!id) {
    throw new Response('No X-Github-Delivery found on request', {
      status: 400,
    })
  }

  const event = await ctx.request.json()

  if (!event?.action) {
    throw new Error('No event body action found on request')
  }

  if (event.action == 'created') {
    sponsorCreated({
      login: event.sponsorship.sponsor.login,
      newTier: event.sponsorship.tier,
    })
    return new Response('Created', { status: 200 })
  }

  if (event.action == 'cancelled') {
    sponsorCancelled({
      login: event.sponsorship.sponsor.login,
      oldTier: event.sponsorship.tier,
    })
    return new Response('Cancelled', { status: 200 })
  }

  if (event.action == 'tier_changed') {
    sponsorEdited({
      login: event.sponsorship.sponsor.login,
      oldTier: event.changes.tier,
      newTier: event.sponsorship.tier,
    })
    return new Response('Updated', { status: 200 })
  }

  return new Response('OK', { status: 200 })
}
