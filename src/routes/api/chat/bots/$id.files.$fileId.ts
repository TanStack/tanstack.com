import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/bots/$id/files/$fileId')({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
      POST: ({ request }) => forwardWorkerRequest('CHAT', request),
      PUT: ({ request }) => forwardWorkerRequest('CHAT', request),
      DELETE: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
