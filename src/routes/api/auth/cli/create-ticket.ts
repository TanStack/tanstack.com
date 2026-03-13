import { createFileRoute } from '@tanstack/react-router'
import { createCliTicket } from '~/auth/cli-tickets.server'

export const Route = createFileRoute('/api/auth/cli/create-ticket')({
  server: {
    handlers: {
      POST: async () => {
        const ticketId = createCliTicket()
        return Response.json({ ticketId })
      },
    },
  },
})
