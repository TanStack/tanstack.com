import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/workspace-history', z.object({}), {
  POST: async ({ request }) => {
    const { handleBotMutation } =
      await import('~/chat/server/bot-mutation-http.server')
    return handleBotMutation(request, undefined, undefined, 'history')
  },
})
