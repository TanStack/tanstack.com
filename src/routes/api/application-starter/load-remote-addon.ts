import { createFileRoute } from "@tanstack/react-router";
import {
  applicationStarterErrorResponse,
  applicationStarterJsonResponse,
  validateApplicationStarterGetRequest,
} from "~/application-starter/api/request-boundary.server";
import { RATE_LIMITS } from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/application-starter/load-remote-addon")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const requestGuard = await validateApplicationStarterGetRequest(request, {
          rateLimit: RATE_LIMITS.applicationStarterRemote,
        });
        if ("response" in requestGuard) {
          return requestGuard.response;
        }

        const url = new URL(request.url);
        const integrationUrl = url.searchParams.get("url");

        if (!integrationUrl) {
          return applicationStarterErrorResponse("URL is required", 400, requestGuard.rateLimit);
        }

        const { loadRemoteIntegrationHandler } = await import(
          "~/application-starter/api/remote",
        );
        const response = await loadRemoteIntegrationHandler(integrationUrl);
        return applicationStarterJsonResponse(response, requestGuard.rateLimit);
      },
    },
  },
});
