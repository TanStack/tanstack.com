import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import { env } from '~/utils/env'

export const Route = createFileRoute('/.well-known/oauth-authorization-server')(
  {
    server: {
      handlers: {
        GET: async ({ request }: { request: Request }) => {
          const origin = env.SITE_URL || new URL(request.url).origin

          const metadata = {
            issuer: origin,
            authorization_endpoint: `${origin}/oauth/authorize`,
            token_endpoint: `${origin}/oauth/token`,
            registration_endpoint: `${origin}/oauth/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            scopes_supported: ['api'],
          }

          setResponseHeader('Content-Type', 'application/json')
          setResponseHeader('Cache-Control', 'public, max-age=3600')
          setResponseHeader('Access-Control-Allow-Origin', '*')
          setResponseHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

          return new Response(JSON.stringify(metadata, null, 2))
        },
        OPTIONS: async () => {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          })
        },
      },
    },
  },
)
