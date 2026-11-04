import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/project-snapshots/$hash')({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('CHAT', request),
    },
  },
})
