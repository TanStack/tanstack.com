import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/servers/$serverId/check',
  z.object({ serverId: z.string() }),
  {
    POST: async ({ request, params }) => {
      const { handleKodyControl } =
        await import('~/chat/server/kody-control-http.server')
      return handleKodyControl(request, 'server-check', params.serverId)
    },
  },
)
