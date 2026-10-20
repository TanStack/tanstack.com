import { createFileRoute } from '@tanstack/react-router'
import { forwardWorkerRequest } from '~/server/runtime/worker-service.server'

export const Route = createFileRoute('/api/chat/kody/mail/messages/$messageId')(
  {
    server: {
      handlers: {
        GET: ({ request }) => forwardWorkerRequest('CHAT', request),
      },
    },
  },
)
