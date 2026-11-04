import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/memories/create/review',
  z.object({}),
  {
    POST: async ({ request }) => {
      const { handleKodyMemoryMutation } =
        await import('~/chat/server/kody-memory-http.server')
      return handleKodyMemoryMutation(request, 'review')
    },
  },
)
