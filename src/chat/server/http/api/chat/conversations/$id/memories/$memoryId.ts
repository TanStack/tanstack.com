import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/memories/$memoryId',
  z.object({ id: z.string(), memoryId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleMemory } = await import('~/chat/server/memory-http.server')
      return handleMemory(request, params.id, params.memoryId)
    },
    POST: async ({ request, params }) => {
      const { handleMemory } = await import('~/chat/server/memory-http.server')
      return handleMemory(request, params.id, params.memoryId)
    },
  },
)
