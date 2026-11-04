import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/files', z.object({}), {
  GET: async (context) => {
    const { handlers } = await import('~/chat/server/routes/files')
    return handlers.GET(context)
  },
  PUT: async (context) => {
    const { handlers } = await import('~/chat/server/routes/files')
    return handlers.PUT(context)
  },
})
