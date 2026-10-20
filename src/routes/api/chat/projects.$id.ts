import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/projects/$id')({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
      PATCH: ({ request }) => forwardWorkerRequest('CHAT', request),
      DELETE: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
