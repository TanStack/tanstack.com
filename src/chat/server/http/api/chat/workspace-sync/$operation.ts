import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/workspace-sync/$operation',
  z.object({ operation: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleWorkspaceSync } =
        await import('~/chat/server/workspace-sync-http.server')
      return handleWorkspaceSync(request, params.operation)
    },
  },
)
