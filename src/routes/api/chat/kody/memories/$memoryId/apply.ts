import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/kody/memories/$memoryId/apply')(
  {
    server: {
      handlers: {
        POST: ({ request }) => forwardWorkerRequest('CHAT', request),
      },
    },
  },
)
