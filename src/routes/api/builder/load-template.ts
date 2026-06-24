import { createFileRoute } from "@tanstack/react-router";
import {
  builderErrorResponse,
  builderJsonResponse,
  readBuilderJsonRequest,
} from "~/builder/api/request-boundary.server";
import {
  builderRemoteLoadBodySchema,
  parseBuilderRequest,
} from "~/builder/api/request-schema.server";
import { RATE_LIMITS } from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/builder/load-template")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const requestBody = await readBuilderJsonRequest(request, {
            rateLimit: RATE_LIMITS.builderRemote,
          });
          if ("response" in requestBody) {
            return requestBody.response;
          }

          let body;
          try {
            body = parseBuilderRequest(
              builderRemoteLoadBodySchema,
              requestBody.body,
            );
          } catch {
            return builderErrorResponse(
              "Invalid request body",
              400,
              requestBody.rateLimit,
            );
          }

          const { loadRemoteTemplateHandler } = await import(
            "~/builder/api/remote",
          );
          const response = await loadRemoteTemplateHandler(body.url);
          return builderJsonResponse(response, requestBody.rateLimit);
        } catch (error) {
          console.error("Error loading remote template:", error);
          return builderErrorResponse("Failed to load remote template", 500);
        }
      },
    },
  },
});
