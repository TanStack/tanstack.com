import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute(
  '/api/chat/conversations/$id/workflow-runs/$runId',
)({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
