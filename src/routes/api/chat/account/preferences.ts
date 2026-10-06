import { createFileRoute } from '@tanstack/react-router'
import { handleAccountPreferences } from '~/chat/server/account-preferences-http.server'
export const Route = createFileRoute('/api/chat/account/preferences')({
  server: { handlers: { GET: ({ request }) => handleAccountPreferences(request), POST: ({ request }) => handleAccountPreferences(request) } },
})
