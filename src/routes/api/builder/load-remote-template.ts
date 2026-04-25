import { createFileRoute } from "@tanstack/react-router";
import { loadRemoteTemplateHandler } from "~/builder/api";

export const Route = createFileRoute("/api/builder/load-remote-template")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { checkIpRateLimit, rateLimitedResponse, RATE_LIMITS } =
          await import("~/utils/rateLimit.server");
        // Rate limiting (30 requests/minute per IP)
        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.builderRemote,
        );
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit);
        }

        const url = new URL(request.url);
        const templateUrl = url.searchParams.get("url");

        if (!templateUrl) {
          return new Response(JSON.stringify({ error: "URL is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const response = await loadRemoteTemplateHandler(templateUrl);
        return new Response(JSON.stringify(response), {
          status: response.error ? 400 : 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
