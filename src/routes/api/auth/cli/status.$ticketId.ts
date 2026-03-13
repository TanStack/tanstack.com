import { createFileRoute } from '@tanstack/react-router'
import { getCliTicket, consumeCliTicket } from '~/auth/cli-tickets.server'

export const Route = createFileRoute('/api/auth/cli/status/$ticketId')({
  server: {
    handlers: {
      GET: async ({
        params,
      }: {
        request: Request
        params: { ticketId: string }
      }) => {
        const ticket = getCliTicket(params.ticketId)

        if (!ticket) {
          return Response.json({ error: 'Ticket not found or expired' }, { status: 404 })
        }

        if (!ticket.authorized) {
          return Response.json({ authorized: false })
        }

        // Consume the ticket and return the session token
        const sessionToken = consumeCliTicket(params.ticketId)
        if (!sessionToken) {
          return Response.json({ error: 'Ticket not found or expired' }, { status: 404 })
        }

        return Response.json({ authorized: true, sessionToken })
      },
    },
  },
})
