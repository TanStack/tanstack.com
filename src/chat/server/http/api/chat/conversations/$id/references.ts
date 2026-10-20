import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/references',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleReferences } =
        await import('~/chat/server/reference-http.server')
      return handleReferences(request, params.id)
    },
  },
)
