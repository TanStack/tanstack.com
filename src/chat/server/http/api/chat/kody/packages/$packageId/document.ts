import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/packages/$packageId/document',
  z.object({ packageId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleKodyAccount } =
        await import('~/chat/server/kody-account-http.server')
      return handleKodyAccount(request, 'package-document', params.packageId)
    },
  },
)
