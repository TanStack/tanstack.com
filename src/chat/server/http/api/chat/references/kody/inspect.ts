import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/references/kody/inspect',
  z.object({}),
  {
    GET: async ({ request }) => {
      const { handleReferenceCatalog } =
        await import('~/chat/server/reference-catalog-http.server')
      return handleReferenceCatalog(request, 'kody-inspect')
    },
  },
)
