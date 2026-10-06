import { createFileRoute } from '@tanstack/react-router'
import { handleOnboarding } from '~/chat/server/onboarding-http.server'
export const Route = createFileRoute('/api/chat/account/onboarding')({
  server: { handlers: { GET: ({ request }) => handleOnboarding(request), POST: ({ request }) => handleOnboarding(request) } },
})
