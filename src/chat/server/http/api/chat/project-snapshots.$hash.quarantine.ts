import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/project-snapshots/$hash/quarantine',
  z.object({ hash: z.string() }),
  {
    POST: async (context) => {
      const { handlers } =
        await import('~/chat/server/routes/project-snapshots.$hash.quarantine')
      return handlers.POST({
        request: context.request,
        params: { hash: context.params.hash },
      })
    },
  },
)
