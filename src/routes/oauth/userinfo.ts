import { createFileRoute } from '@tanstack/react-router'
import { handleUserInfo, oauthOptions } from '~/auth/oauth-endpoints.server'

export const Route = createFileRoute('/oauth/userinfo')({
  server: {
    handlers: {
      GET: ({ request }) => handleUserInfo(request),
      OPTIONS: oauthOptions,
    },
  },
})
