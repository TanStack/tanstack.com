import { createFileRoute } from '@tanstack/react-router'
import { handleSessionHint } from '~/auth/oauth-session-hint.server'

export const Route = createFileRoute('/oauth/session-hint')({
  server: {
    handlers: {
      GET: ({ request }) => handleSessionHint(request),
      OPTIONS: ({ request }) => handleSessionHint(request),
    },
  },
})
