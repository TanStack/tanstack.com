import crypto from 'crypto'
import { middleware } from '../../server/middleware'

import {
  inviteAllSponsors,
  sponsorCreated,
  sponsorCancelled,
  sponsorEdited,
} from '../../server/sponsors'

async function verifySecret(req) {
  const sig = req.headers['x-hub-signature'] || ''
  const hmac = crypto.createHmac(
    'sha1',
    process.env.GITHUB_SPONSORS_WEBHOOK_SECRET
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

export default async function handler(req, res) {
  await middleware(req, res)
  await verifySecret(req, res)

  const githubEvent = req.headers['x-github-event']
  const id = req.headers['x-github-delivery']

  if (!githubEvent) {
    return res.status(400).send('No X-Github-Event found on request')
  }

  if (!id) {
    return res.status(400).send('No X-Github-Delivery found on request')
  }

  const event = req.body

  if ('hook' in event) {
    if (event.hook.name === 'web' && event.hook.type === 'SponsorsListing') {
      inviteAllSponsors()
    }
    res.status(200).send('OK')
    return
  }

  if (event.action == 'created') {
    sponsorCreated({
      login: event.sponsorship.sponsor.login,
      newTier: event.sponsorship.tier,
    })
    res.status(200).send('OK')
    return
  }

  if (event.action == 'cancelled') {
    sponsorCancelled({
      login: event.sponsorship.sponsor.login,
      oldTier: event.sponsorship.tier,
    })
    res.status(200).send('OK')
    return
  }

  if (event.action == 'tier_changed') {
    sponsorEdited({
      login: event.sponsorship.sponsor.login,
      oldTier: event.changes.tier,
      newTier: event.sponsorship.tier,
    })
    res.status(200).send('OK')
    return
  }

  res.status(200).send('Not handling this event')
}
