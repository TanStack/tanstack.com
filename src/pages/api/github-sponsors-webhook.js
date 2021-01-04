import { middleware } from '../../server/middleware'

async function verifySecret(req, res) {
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

  res.status(200)
  // .json({
  //   message: Date.now(),
  // })
}
