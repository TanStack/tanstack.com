import { createFileRoute } from '@tanstack/react-router'
import { handleRevocation, oauthOptions } from '~/auth/oauth-endpoints.server'

export const Route = createFileRoute('/oauth/revoke')({
  server: {
    handlers: {
      POST: ({ request }) => handleRevocation(request),
      OPTIONS: oauthOptions,
    },
  },
})
