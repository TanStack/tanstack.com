import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/kody/usage', z.object({}), {
  GET: async ({ request }) => {
    const { handleKodyAccount } =
      await import('~/chat/server/kody-account-http.server')
    return handleKodyAccount(request, 'usage')
  },
})
