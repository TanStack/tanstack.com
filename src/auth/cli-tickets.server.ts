/**
 * CLI Auth Ticket Store
 *
 * In-memory store for short-lived CLI authentication tickets.
 * Tickets are created by the CLI, then authorized in the browser after
 * the user completes OAuth. The CLI polls for the token.
 *
 * TTL: 5 minutes. Single-use (consumed on exchange).
 */

const TICKET_TTL_MS = 5 * 60 * 1000

interface CliTicket {
  userId: string | null
  sessionToken: string | null
  expiresAt: number
  authorized: boolean
}

const tickets = new Map<string, CliTicket>()

// Periodic cleanup of expired tickets
setInterval(
  () => {
    const now = Date.now()
    for (const [id, ticket] of tickets) {
      if (ticket.expiresAt < now) {
        tickets.delete(id)
      }
    }
  },
  60 * 1000, // every minute
)

export function createCliTicket(): string {
  const id = crypto.randomUUID()
  tickets.set(id, {
    userId: null,
    sessionToken: null,
    expiresAt: Date.now() + TICKET_TTL_MS,
    authorized: false,
  })
  return id
}

export function getCliTicket(id: string): CliTicket | null {
  const ticket = tickets.get(id)
  if (!ticket) return null
  if (ticket.expiresAt < Date.now()) {
    tickets.delete(id)
    return null
  }
  return ticket
}

export function authorizeCliTicket(
  id: string,
  userId: string,
  sessionToken: string,
): boolean {
  const ticket = getCliTicket(id)
  if (!ticket) return false
  ticket.userId = userId
  ticket.sessionToken = sessionToken
  ticket.authorized = true
  return true
}

export function consumeCliTicket(id: string): string | null {
  const ticket = getCliTicket(id)
  if (!ticket || !ticket.authorized || !ticket.sessionToken) return null
  const { sessionToken } = ticket
  tickets.delete(id)
  return sessionToken
}
