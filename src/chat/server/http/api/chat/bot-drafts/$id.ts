import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/bot-drafts/$id',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleBotDraft } =
        await import('~/chat/server/bot-draft-http.server')
      return handleBotDraft(request, params.id)
    },
    POST: async ({ request, params }) => {
      const { handleBotDraft } =
        await import('~/chat/server/bot-draft-http.server')
      return handleBotDraft(request, params.id)
    },
  },
)
