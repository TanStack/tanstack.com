import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/plugins', z.object({}), {
  GET: async (context) => {
    const { handlers } = await import('~/chat/server/routes/plugins')
    return handlers.GET(context)
  },
  POST: async (context) => {
    const { handlers } = await import('~/chat/server/routes/plugins')
    return handlers.POST(context)
  },
})
