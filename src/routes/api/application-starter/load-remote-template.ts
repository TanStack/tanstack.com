import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute(
  '/api/application-starter/load-remote-template',
)({
  server: {
    handlers: {
      GET: ({ request }) => forwardWorkerRequest('STARTER', request),
    },
  },
})
