import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/sections')({
  server: {
    handlers: {
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
