import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/application-starter/compile')({
  server: {
    handlers: {
      POST: ({ request }) => forwardWorkerRequest('STARTER', request),
    },
  },
})
