import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/retries/$id/prepare',
  z.object({ id: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleConversationRetry } =
        await import('~/chat/server/conversation-retry-http.server')
      return handleConversationRetry(request, params.id, 'prepare')
    },
  },
)
