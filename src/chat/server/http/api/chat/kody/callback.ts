import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/kody/callback', z.object({}), {
  GET: async ({ request }) => {
    const { handleKodyCallback } =
      await import('~/chat/server/kody-callback-http.server')
    return handleKodyCallback(request)
  },
})
