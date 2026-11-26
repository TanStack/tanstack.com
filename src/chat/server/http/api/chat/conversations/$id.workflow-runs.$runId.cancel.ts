import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/workflow-runs/$runId/cancel',
  z.object({ id: z.string(), runId: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleWorkflowRun } =
        await import('~/chat/server/workflow-run-http.server')
      return handleWorkflowRun(request, params.id, params.runId, true)
    },
  },
)
