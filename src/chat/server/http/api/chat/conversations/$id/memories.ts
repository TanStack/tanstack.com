import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/memories',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleMemory } = await import('~/chat/server/memory-http.server')
      return handleMemory(request, params.id)
    },
    POST: async ({ request, params }) => {
      const { handleMemory } = await import('~/chat/server/memory-http.server')
      return handleMemory(request, params.id)
    },
  },
)
