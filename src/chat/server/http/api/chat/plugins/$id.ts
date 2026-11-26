import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/plugins/$id',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handlePlugins } = await import('~/chat/server/routes/plugins')
      return handlePlugins(request, params.id)
    },
    POST: async ({ request, params }) => {
      const { handlePlugins } = await import('~/chat/server/routes/plugins')
      return handlePlugins(request, params.id)
    },
  },
)
