import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/project-snapshots', z.object({}), {
  POST: async (context) => {
    const { handlers } = await import('~/chat/server/routes/project-snapshots')
    return handlers.POST(context)
  },
})
