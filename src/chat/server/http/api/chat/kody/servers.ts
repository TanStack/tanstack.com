import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/kody/servers', z.object({}), {
  POST: async ({ request }) => {
    const { handleKodyControl } =
      await import('~/chat/server/kody-control-http.server')
    return handleKodyControl(request, 'server-add')
  },
})
