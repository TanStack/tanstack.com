import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/kody/runs', z.object({}), {
  GET: async ({ request }) => {
    const { handleKodyAccount } =
      await import('~/chat/server/kody-account-http.server')
    return handleKodyAccount(request, 'runs')
  },
})
