import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/workspace-index', z.object({}), {
  GET: async ({ request }) => {
    const { handleWorkspaceIndex } =
      await import('~/chat/server/workspace-index-http.server')
    return handleWorkspaceIndex(request)
  },
})
