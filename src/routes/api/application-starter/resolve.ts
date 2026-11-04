import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/application-starter/resolve')({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('STARTER', request),
      POST: ({ request }) => forwardWorkerRequest('STARTER', request),
    },
  },
})
