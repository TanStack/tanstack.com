'use node'

import { action } from '../_generated/server'
import { v } from 'convex/values'

/**
 * Verify GitHub webhook signature using Node.js crypto
 * This is in a separate file with 'use node' to access Node.js built-in modules
 */
export const verifyGitHubSignature = action({
  args: {
    payload: v.string(),
    signature: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', args.secret)
    const digest = 'sha256=' + hmac.update(args.payload).digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(args.signature),
      Buffer.from(digest),
    )
  },
})
