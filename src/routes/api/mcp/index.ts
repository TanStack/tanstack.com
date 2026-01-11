import { createFileRoute } from '@tanstack/react-router'
import { handleMcpRequest } from '~/mcp/transport'

export const Route = createFileRoute('/api/mcp/')({
  // @ts-ignore server property not in route types yet
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleMcpRequest(request),
      POST: async ({ request }: { request: Request }) =>
        handleMcpRequest(request),
      DELETE: async ({ request }: { request: Request }) =>
        handleMcpRequest(request),
    },
  },
})
