import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/activity', z.object({}), {
  GET: async ({ request }) => {
    const { handleWorkspaceActivity } =
      await import('~/chat/server/workspace-activity-http.server')
    return handleWorkspaceActivity(request)
  },
})
