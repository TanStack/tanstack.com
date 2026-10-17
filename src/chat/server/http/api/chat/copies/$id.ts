import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/copies/$id',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleConversationCopy } =
        await import('~/chat/server/conversation-copy-http.server')
      return handleConversationCopy(request, params.id, 'operation')
    },
  },
)
