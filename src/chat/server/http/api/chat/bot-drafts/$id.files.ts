import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/bot-drafts/$id/files',
  z.object({ id: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bot-drafts', params.id)
    },
    POST: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bot-drafts', params.id)
    },
    PUT: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bot-drafts', params.id)
    },
    DELETE: async ({ request, params }) => {
      const { handleFiles } = await import('~/chat/server/file-http.server')
      return handleFiles(request, 'bot-drafts', params.id)
    },
  },
)
