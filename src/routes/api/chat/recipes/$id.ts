import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/recipes/$id')({
  server: {
    handlers: {
      DELETE: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
