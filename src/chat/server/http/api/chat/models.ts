import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/models', z.object({}), {
  GET: async (context) => {
    const { handlers } = await import('~/chat/server/routes/models')
    return handlers.GET(context)
  },
})
