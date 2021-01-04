import crypto from 'crypto'
import { middleware } from '../../server/middleware'

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

  console.log(JSON.stringify(req.body, null, 2))

  res.status(200)
  res.json({ status: 'OK' })
}
