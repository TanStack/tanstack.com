import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/projects/$id/sync',
  z.object({ id: z.string() }),
  {
    GET: async (context) => {
      const { handlers } =
        await import('~/chat/server/routes/projects.$id.sync')
      return handlers.GET({
        request: context.request,
        params: { id: context.params.id },
      })
    },
    POST: async (context) => {
      const { handlers } =
        await import('~/chat/server/routes/projects.$id.sync')
      return handlers.POST({
        request: context.request,
        params: { id: context.params.id },
      })
    },
  },
)
