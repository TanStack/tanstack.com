import { createServerFn } from '@tanstack/react-start'
import { getAuthenticatedUser } from './auth.server-helpers'
import { getEffectiveCapabilities } from './capabilities.server'
import { syncAllSources } from '~/server/feed/sync-all'

// Server function to sync all feed sources (admin only)
export const syncAllFeedSources = createServerFn({ method: 'POST' }).handler(
  async () => {
    // Require admin capability
    const user = await getAuthenticatedUser()
    const capabilities = await getEffectiveCapabilities(user.userId)

    if (!capabilities.includes('admin')) {
      throw new Error('Admin capability required')
    }

    return await syncAllSources()
  }
)
