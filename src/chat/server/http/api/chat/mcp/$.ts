import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/mcp/$',
  z.object({ _splat: z.string() }),
  {
    GET: async (context) => {
      const { handlers } = await import('~/chat/server/routes/mcp/$')
      return handlers.GET(context)
    },
    POST: async (context) => {
      const { handlers } = await import('~/chat/server/routes/mcp/$')
      return handlers.POST(context)
    },
  },
)
