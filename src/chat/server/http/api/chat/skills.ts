import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/skills', z.object({}), {
  GET: async (context) => {
    const { handlers } = await import('~/chat/server/routes/skills')
    return handlers.GET(context)
  },
  POST: async (context) => {
    const { handlers } = await import('~/chat/server/routes/skills')
    return handlers.POST(context)
  },
})
