import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/projects/$id',
  z.object({ id: z.string() }),
  {
    GET: async (context) => {
      const { handlers } = await import('~/chat/server/routes/projects.$id')
      return handlers.GET({ params: { id: context.params.id } })
    },
    PATCH: async (context) => {
      const { handlers } = await import('~/chat/server/routes/projects.$id')
      return handlers.PATCH({
        request: context.request,
        params: { id: context.params.id },
      })
    },
    DELETE: async (context) => {
      const { handlers } = await import('~/chat/server/routes/projects.$id')
      return handlers.DELETE({
        request: context.request,
        params: { id: context.params.id },
      })
    },
  },
)
