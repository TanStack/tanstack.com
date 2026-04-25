import { createFileRoute } from "@tanstack/react-router";

async function handleUploadthingRequest(
  method: "GET" | "POST",
  request: Request,
): Promise<Response> {
  const [uploadthing, diagnostics, uploadthingServer] = await Promise.all([
    import("uploadthing/server"),
    import("~/utils/prod-diagnostics.server"),
    import("~/server/uploadthing"),
  ]);
  const handlers = uploadthing.createRouteHandler({
    router: uploadthingServer.uploadRouter,
  });
  const { logUploadthingProbe } = diagnostics;
  const url = new URL(request.url);
  const startedAt = Date.now();

  logUploadthingProbe(method, "start", {
    pathname: url.pathname,
    search: url.search,
    userAgent: request.headers.get("user-agent") ?? "unknown",
  });

  try {
    const response = await handlers(request);
    logUploadthingProbe(method, "end", {
      pathname: url.pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logUploadthingProbe(method, "error", {
      pathname: url.pathname,
      durationMs: Date.now() - startedAt,
      errorMessage,
      errorStack,
    });
    throw error;
  }
}

export const Route = createFileRoute("/api/uploadthing")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleUploadthingRequest("GET", request),
      POST: async ({ request }: { request: Request }) =>
        handleUploadthingRequest("POST", request),
    },
  },
});
