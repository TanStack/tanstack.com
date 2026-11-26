import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/og/{$}.png')({
  server: {
    handlers: { GET: ({ request }) => forwardWorkerRequest('OG', request) },
  },
})
