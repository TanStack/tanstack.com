import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/auth/mcp/client-metadata', z.object({}), {
  GET: async ({ request }) => {
    const { handleMcpOAuth } =
      await import('~/chat/server/mcp-oauth-route.server')
    return handleMcpOAuth(request)
  },
})
