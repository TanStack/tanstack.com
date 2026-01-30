import { createFileRoute } from '@tanstack/react-router'
import { syncAllSources } from '~/server/feed/sync-all'
import { getAuthenticatedUser } from '~/utils/auth.server-helpers'
import { getEffectiveCapabilities } from '~/utils/capabilities.server'

export const Route = createFileRoute('/api/admin/sync')({
  server: {
    handlers: {
      POST: async () => {
        try {
          // Require admin capability
          const user = await getAuthenticatedUser()
          const capabilities = await getEffectiveCapabilities(user.userId)

          if (!capabilities.includes('admin')) {
            return new Response(
              JSON.stringify({ error: 'Admin capability required' }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }

          console.log('[admin/sync] Starting sync all sources...')

          const result = await syncAllSources()

          console.log('[admin/sync] Sync completed:', result)

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[admin/sync] Error:', error)

          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      },
    },
  },
})

