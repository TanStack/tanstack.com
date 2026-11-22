import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/app-version', z.object({}), {
  GET: async () => {
    const { appBuildId } = await import('~/chat/core/app-version')
    return Response.json(
      { build: appBuildId },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  },
})
