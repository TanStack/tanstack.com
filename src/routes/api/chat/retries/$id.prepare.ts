import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/retries/$id/prepare')({
  server: {
    handlers: {
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
