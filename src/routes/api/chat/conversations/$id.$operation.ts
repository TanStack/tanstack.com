import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/conversations/$id/$operation')({
  server: {
    handlers: {
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
      DELETE: ({ request }) => forwardWorkerRequest('CHAT', request),
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
