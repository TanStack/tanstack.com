import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import { SITE_URL } from '~/utils/site'

export const Route = createFileRoute('/.well-known/oauth-authorization-server')(
  {
    server: {
      handlers: {
        GET: async () => {
          const metadata = {
            issuer: SITE_URL,
            authorization_endpoint: `${SITE_URL}/oauth/authorize`,
            token_endpoint: `${SITE_URL}/oauth/token`,
            registration_endpoint: `${SITE_URL}/oauth/register`,
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
