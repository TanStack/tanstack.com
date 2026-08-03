import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonResponse } from "~/utils/api-boundary.server";

const CLI_TICKET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/auth/cli/status/$ticketId")({
  server: {
    handlers: {
      GET: async ({
        params,
      }: {
        request: Request;
        params: { ticketId: string };
      }) => {
        if (!CLI_TICKET_ID_PATTERN.test(params.ticketId)) {
          return jsonError("Invalid ticket id", 400);
        }

        const { getCliTicket, consumeCliTicket } = await import(
          "~/auth/cli-tickets.server"
        );
        const ticket = getCliTicket(params.ticketId);

        if (!ticket) {
          return jsonError("Ticket not found or expired", 404);
        }

        if (!ticket.authorized) {
          return jsonResponse({ authorized: false });
        }

        // Consume the ticket and return the session token
        const sessionToken = consumeCliTicket(params.ticketId);
        if (!sessionToken) {
          return jsonError("Ticket not found or expired", 404);
        }

        return jsonResponse({ authorized: true, sessionToken });
      },
    },
  },
});
