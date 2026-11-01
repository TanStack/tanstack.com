import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/bots/$id/files/$fileId',
  z.object({ id: z.string(), fileId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bots', params.id, params.fileId)
    },
    POST: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bots', params.id, params.fileId)
    },
    PUT: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bots', params.id, params.fileId)
    },
    DELETE: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bots', params.id, params.fileId)
    },
  },
)
