import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/draft', z.object({}), {
  GET: async (context) => {
    const { handlers } = await import('~/chat/server/routes/draft')
    return handlers.GET(context)
  },
  POST: async (context) => {
    const { handlers } = await import('~/chat/server/routes/draft')
    return handlers.POST(context)
  },
})
