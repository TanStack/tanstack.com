import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/projects', z.object({}), {
  GET: async (context) => {
    const { handlers } = await import('~/chat/server/routes/projects')
    return handlers.GET(context)
  },
  POST: async (context) => {
    const { handlers } = await import('~/chat/server/routes/projects')
    return handlers.POST(context)
  },
})
