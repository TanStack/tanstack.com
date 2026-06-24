import { createFileRoute } from "@tanstack/react-router";
import {
  builderErrorResponse,
  builderJsonResponse,
  validateBuilderGetRequest,
} from "~/builder/api/request-boundary.server";
import { RATE_LIMITS } from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/builder/load-remote-addon")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const requestGuard = await validateBuilderGetRequest(request, {
          rateLimit: RATE_LIMITS.builderRemote,
        });
        if ("response" in requestGuard) {
          return requestGuard.response;
        }

        const url = new URL(request.url);
        const integrationUrl = url.searchParams.get("url");

        if (!integrationUrl) {
          return builderErrorResponse("URL is required", 400, requestGuard.rateLimit);
        }

        const { loadRemoteIntegrationHandler } = await import(
          "~/builder/api/remote",
        );
        const response = await loadRemoteIntegrationHandler(integrationUrl);
        return builderJsonResponse(response, requestGuard.rateLimit);
      },
    },
  },
});
