import { createFileRoute } from "@tanstack/react-router";

async function handleUploadthingRequest(
  request: Request,
): Promise<Response> {
  const [uploadthing, uploadthingServer] = await Promise.all([
    import("uploadthing/server"),
    import("~/server/uploadthing"),
  ]);
  const handlers = uploadthing.createRouteHandler({
    router: uploadthingServer.uploadRouter,
  });
  return handlers(request);
}

export const Route = createFileRoute("/api/uploadthing")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleUploadthingRequest(request),
      POST: async ({ request }: { request: Request }) =>
        handleUploadthingRequest(request),
    },
  },
});
