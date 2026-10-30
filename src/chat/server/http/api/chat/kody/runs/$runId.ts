import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/runs/$runId',
  z.object({ runId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleKodyAccount } =
        await import('~/chat/server/kody-account-http.server')
      return handleKodyAccount(request, 'runs', params.runId)
    },
  },
)
