import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/memories/$memoryId/review',
  z.object({ memoryId: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleKodyMemoryMutation } =
        await import('~/chat/server/kody-memory-http.server')
      return handleKodyMemoryMutation(request, 'review', params.memoryId)
    },
  },
)
