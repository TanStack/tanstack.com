import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/recipes', z.object({}), {
  POST: async ({ request }) => {
    const { handleSavedActions } =
      await import('~/chat/server/saved-actions-http.server')
    return handleSavedActions(request)
  },
})
