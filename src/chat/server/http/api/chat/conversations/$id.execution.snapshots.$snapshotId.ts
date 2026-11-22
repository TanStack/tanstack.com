import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/execution/snapshots/$snapshotId',
  z.object({ id: z.string(), snapshotId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleConversationExecution } =
        await import('~/chat/server/conversation-execution-http.server')
      return handleConversationExecution(request, params.id, params.snapshotId)
    },
    PUT: async ({ request, params }) => {
      const { handleConversationExecution } =
        await import('~/chat/server/conversation-execution-http.server')
      return handleConversationExecution(request, params.id, params.snapshotId)
    },
  },
)
