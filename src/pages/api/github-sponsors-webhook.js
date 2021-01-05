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

  // const { body } = req

  // switch (body.action) {
  //   case 'created':
  //     {
  //       const {
  //         sponsorship: {
  //           created_at,
  //           sponsor: { login: username },
  //           tier: {
  //             node_id: tier_id,
  //             name: tier_name
  //           }
  //         },
  //       } = body

  //       "tier": {
  //         "node_id": "MDEyOlNwb25zb3JzVGllcjE=",
  //         "created_at": "2019-12-20T19:17:05Z",
  //         "description": "foo",
  //         "monthly_price_in_cents": 500,
  //         "monthly_price_in_dollars": 5,
  //         "name": "$5 a month"
  //       }
  //     }
  //     break
  //   case 'cancelled':
  //     break
  //   case 'edited':
  //     break
  //   case 'tier_changed':
  //     break
  //   case 'pending_cancellation':
  //     break
  //   case 'pending_tier_change':
  //     break
  // }

  res.status(200)
  res.json({ status: 'ok' })
}
