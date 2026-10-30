import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/kody/connect', z.object({}), {
  POST: async ({ request }) => {
    const { handleKodyConnect } =
      await import('~/chat/server/kody-connect-http.server')
    return handleKodyConnect(request)
  },
})
