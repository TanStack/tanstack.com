import { createFileRoute } from '@tanstack/react-router'
import {
  handleIntrospection,
  oauthOptions,
} from '~/auth/oauth-endpoints.server'

export const Route = createFileRoute('/oauth/introspect')({
  server: {
    handlers: {
      POST: ({ request }) => handleIntrospection(request),
      OPTIONS: oauthOptions,
    },
  },
})
