import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/connection', z.object({}), {
  POST: async ({ request }) => {
    const { handleProviderConnection } =
      await import('~/chat/server/provider-connection-http.server')
    return handleProviderConnection(request)
  },
})
