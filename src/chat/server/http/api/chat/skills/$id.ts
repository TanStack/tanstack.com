import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/skills/$id',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleSkills } = await import('~/chat/server/routes/skills')
      return handleSkills(request, params.id)
    },
    POST: async ({ request, params }) => {
      const { handleSkills } = await import('~/chat/server/routes/skills')
      return handleSkills(request, params.id)
    },
  },
)
