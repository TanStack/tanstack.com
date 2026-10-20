import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute(
  '/api/application-starter/deploy/check-name',
)({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('STARTER', request),
    },
  },
})
