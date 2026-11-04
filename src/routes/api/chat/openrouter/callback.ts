import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/openrouter/callback')({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
