import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/kody/unlink', z.object({}), {
  POST: async ({ request }) => {
    const { handleKodyUnlink } =
      await import('~/chat/server/kody-unlink-http.server')
    return handleKodyUnlink(request)
  },
})
