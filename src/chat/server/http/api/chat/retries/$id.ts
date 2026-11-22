import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/retries/$id',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleConversationRetry } =
        await import('~/chat/server/conversation-retry-http.server')
      return handleConversationRetry(request, params.id, 'get')
    },
  },
)
