import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/references', z.object({}), {
  GET: async ({ request }) => {
    const { handleReferences } =
      await import('~/chat/server/reference-http.server')
    return handleReferences(request)
  },
})
