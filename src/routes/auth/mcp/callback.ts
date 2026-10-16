import { createFileRoute } from '@tanstack/react-router'
import { handleMcpOAuth } from '~/chat/server/mcp-oauth-route.server'
export const Route = createFileRoute('/auth/mcp/callback')({
  server: { handlers: { GET: ({ request }) => handleMcpOAuth(request) } },
})
