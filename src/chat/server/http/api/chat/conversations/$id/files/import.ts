import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/files/import',
  z.object({ id: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleFileImport } =
        await import('~/chat/server/file-http.server')
      return handleFileImport(request, params.id)
    },
  },
)
