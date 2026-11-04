import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/recipes/$id',
  z.object({ id: z.string() }),
  {
    DELETE: async ({ request, params }) => {
      const { handleSavedActions } =
        await import('~/chat/server/saved-actions-http.server')
      return handleSavedActions(request, params.id)
    },
  },
)
