import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/conversations/$id/workflows/$workflowId',
  z.object({ id: z.string(), workflowId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleWorkflow } =
        await import('~/chat/server/workflow-http.server')
      return handleWorkflow(request, params.id, params.workflowId)
    },
  },
)
