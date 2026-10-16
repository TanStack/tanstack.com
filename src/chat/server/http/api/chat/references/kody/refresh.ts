import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/references/kody/refresh',
  z.object({}),
  {
    POST: async ({ request }) => {
      const { handleReferenceCatalog } =
        await import('~/chat/server/reference-catalog-http.server')
      return handleReferenceCatalog(request, 'kody-refresh')
    },
  },
)
