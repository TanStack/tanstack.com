import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/sections', z.object({}), {
  POST: async ({ request }) => {
    const { handleWorkspaceSections } =
      await import('~/chat/server/workspace-sections-http.server')
    return handleWorkspaceSections(request)
  },
})
