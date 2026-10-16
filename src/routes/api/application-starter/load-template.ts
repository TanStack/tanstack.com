import { createFileRoute } from "@tanstack/react-router";
import {
  applicationStarterErrorResponse,
  applicationStarterJsonResponse,
  readApplicationStarterJsonRequest,
} from "~/application-starter/api/request-boundary.server";
import {
  applicationStarterRemoteLoadBodySchema,
  parseApplicationStarterRequest,
} from "~/application-starter/api/request-schema.server";
import { RATE_LIMITS } from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/application-starter/load-template")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const requestBody = await readApplicationStarterJsonRequest(request, {
            rateLimit: RATE_LIMITS.applicationStarterRemote,
          });
          if ("response" in requestBody) {
            return requestBody.response;
          }

          let body;
          try {
            body = parseApplicationStarterRequest(
              applicationStarterRemoteLoadBodySchema,
              requestBody.body,
            );
          } catch {
            return applicationStarterErrorResponse(
              "Invalid request body",
              400,
              requestBody.rateLimit,
            );
          }

          const { loadRemoteTemplateHandler } = await import(
            "~/application-starter/api/remote",
          );
          const response = await loadRemoteTemplateHandler(body.url);
          return applicationStarterJsonResponse(response, requestBody.rateLimit);
        } catch (error) {
          console.error("Error loading remote template:", error);
          return applicationStarterErrorResponse("Failed to load remote template", 500);
        }
      },
    },
  },
});
