import { createFileRoute } from "@tanstack/react-router";

async function handleRequest(request: Request) {
  const { handleMcpRequest } = await import("~/mcp/transport");

  return handleMcpRequest(request);
}

export const Route = createFileRoute("/api/mcp/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleRequest(request),
      POST: async ({ request }: { request: Request }) => handleRequest(request),
      DELETE: async ({ request }: { request: Request }) =>
        handleRequest(request),
    },
  },
});
