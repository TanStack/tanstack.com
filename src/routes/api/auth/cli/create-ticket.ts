import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/cli/create-ticket")({
  server: {
    handlers: {
      POST: async () => {
        const { createCliTicket } = await import("~/auth/cli-tickets.server");
        const ticketId = createCliTicket();
        return Response.json({ ticketId });
      },
    },
  },
});
