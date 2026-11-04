import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/openrouter/callback', z.object({}), {
  GET: async () => {
    const { handlers } =
      await import('~/chat/server/routes/openrouter/callback')
    return handlers.GET()
  },
})
