import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/kody/runs/$runId')({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
