import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/bots/$id/$operation')({
  server: {
    handlers: {
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
      PATCH: ({ request }) => forwardWorkerRequest('CHAT', request),
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
