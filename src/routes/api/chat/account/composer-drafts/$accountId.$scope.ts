import { createFileRoute } from '@tanstack/react-router'
import { handleComposerDraft } from '~/chat/server/composer-draft-http.server'
export const Route = createFileRoute('/api/chat/account/composer-drafts/$accountId/$scope')({
  server: { handlers: {
    GET: ({ request, params }) => handleComposerDraft(request, params.accountId, params.scope),
    POST: ({ request, params }) => handleComposerDraft(request, params.accountId, params.scope),
  } },
})
