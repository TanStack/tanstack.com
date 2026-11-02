import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/account/composer-drafts/$accountId/$scope',
  z.object({ accountId: z.string(), scope: z.string() }),
  {
    GET: async ({ request, params }) => {
      const { handleComposerDraft } =
        await import('~/chat/server/composer-draft-http.server')
      return handleComposerDraft(request, params.accountId, params.scope)
    },
    POST: async ({ request, params }) => {
      const { handleComposerDraft } =
        await import('~/chat/server/composer-draft-http.server')
      return handleComposerDraft(request, params.accountId, params.scope)
    },
  },
)
