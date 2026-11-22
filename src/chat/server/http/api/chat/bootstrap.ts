import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/bootstrap', z.object({}), {
  GET: async ({ request }) => {
    const { handleBootstrap } =
      await import('~/chat/server/bootstrap-http.server')
    return handleBootstrap(request)
  },
})
