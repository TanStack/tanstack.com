import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute(
  '/api/chat/conversations/$id/workflow-runs/$runId/cancel',
)({
  server: {
    handlers: {
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
