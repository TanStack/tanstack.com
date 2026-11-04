import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/policy', z.object({}), {
  POST: async ({ request }) => {
    const { handleWorkspacePolicy } =
      await import('~/chat/server/workspace-policy-http.server')
    return handleWorkspacePolicy(request)
  },
})
