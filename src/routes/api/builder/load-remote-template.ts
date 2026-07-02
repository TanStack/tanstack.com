import { createFileRoute } from "@tanstack/react-router";
import {
  builderErrorResponse,
  builderJsonResponse,
  validateBuilderGetRequest,
} from "~/builder/api/request-boundary.server";
import { RATE_LIMITS } from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/builder/load-remote-template")({
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
        const templateUrl = url.searchParams.get("url");

        if (!templateUrl) {
          return builderErrorResponse("URL is required", 400, requestGuard.rateLimit);
        }

        const { loadRemoteTemplateHandler } = await import("~/builder/api/remote");
        const response = await loadRemoteTemplateHandler(templateUrl);
        return builderJsonResponse(response, requestGuard.rateLimit);
      },
    },
  },
});
