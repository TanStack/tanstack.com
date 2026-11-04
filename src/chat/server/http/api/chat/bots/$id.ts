import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/bots/$id',
  z.object({ id: z.string() }),
  {
    PATCH: async ({ request, params }) => {
      const { handleBotMutation } =
        await import('~/chat/server/bot-mutation-http.server')
      return handleBotMutation(request, params.id)
    },
  },
)
