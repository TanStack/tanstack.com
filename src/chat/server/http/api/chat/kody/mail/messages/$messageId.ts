import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/kody/mail/messages/$messageId',
  z.object({ messageId: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleKodyAccount } =
        await import('~/chat/server/kody-account-http.server')
      return handleKodyAccount(request, 'mail-messages', params.messageId)
    },
  },
)
