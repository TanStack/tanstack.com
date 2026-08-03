import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "~/utils/api-boundary.server";
import {
  checkIpRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/auth/cli/create-ticket")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.cliAuthTicket,
        );
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit);
        }

        const { createCliTicket } = await import("~/auth/cli-tickets.server");
        const ticketId = createCliTicket();
        return jsonResponse({ ticketId }, { headers: rateLimit.headers });
      },
    },
  },
});
