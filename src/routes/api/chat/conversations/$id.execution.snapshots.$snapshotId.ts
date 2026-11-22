import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute(
  '/api/chat/conversations/$id/execution/snapshots/$snapshotId',
)({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
      PUT: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
