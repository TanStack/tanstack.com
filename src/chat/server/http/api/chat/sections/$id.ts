import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/sections/$id',
  z.object({ id: z.string() }),
  {
    PATCH: async ({ request, params }) => {
      const { handleWorkspaceSections } =
        await import('~/chat/server/workspace-sections-http.server')
      return handleWorkspaceSections(request, params.id)
    },
    DELETE: async ({ request, params }) => {
      const { handleWorkspaceSections } =
        await import('~/chat/server/workspace-sections-http.server')
      return handleWorkspaceSections(request, params.id)
    },
  },
)
