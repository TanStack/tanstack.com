import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/runs/$runId/triage',
  z.object({ runId: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleKodyControl } =
        await import('~/chat/server/kody-control-http.server')
      return handleKodyControl(request, 'run-triage', params.runId)
    },
  },
)
