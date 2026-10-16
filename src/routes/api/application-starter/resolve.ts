import { createFileRoute } from '@tanstack/react-router'
import {
  checkIpWindowRateLimit,
  checkIpRateLimit,
  getIpWindowRateLimitStatus,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'
import { envFunctions } from '~/utils/env.functions'
import {
  isRecord,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'

const MAX_APPLICATION_STARTER_BODY_BYTES = 16 * 1024

export const Route = createFileRoute('/api/application-starter/resolve')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          if (!envFunctions.DATABASE_URL) {
            return new Response(
              JSON.stringify({
                authenticated: false,
                anonymousGenerationQuota: {
                  limit: RATE_LIMITS.applicationStarterAnonymousDaily.limit,
                  remaining: RATE_LIMITS.applicationStarterAnonymousDaily.limit,
                  resetAt: new Date(
                    Date.now() +
                      RATE_LIMITS.applicationStarterAnonymousDaily.windowMs,
                  ).toISOString(),
                },
              }),
              {
                headers: {
                  'Cache-Control': 'no-store',
                  'Content-Type': 'application/json',
                },
              },
            )
          }

          const [{ getAuthService }, anonymousQuota] = await Promise.all([
            import('~/auth/index.server'),
            getIpWindowRateLimitStatus(
              request,
              RATE_LIMITS.applicationStarterAnonymousDaily,
            ),
          ])

          const authService = getAuthService()
          const user = await authService.getCurrentUser(request)

          return new Response(
            JSON.stringify({
              authenticated: !!user,
              anonymousGenerationQuota: user
                ? null
                : {
                    limit: anonymousQuota.limit,
                    remaining: anonymousQuota.remaining,
                    resetAt: anonymousQuota.resetAt.toISOString(),
                  },
            }),
            {
              headers: {
                'Cache-Control': 'no-store',
                'Content-Type': 'application/json',
              },
            },
          )
        } catch (error) {
          console.error('Error loading application starter status:', error)

          return new Response(
            JSON.stringify({
              error: 'Failed to load application starter status',
            }),
            {
              status: 500,
              headers: {
                'Cache-Control': 'no-store',
                'Content-Type': 'application/json',
              },
            },
          )
        }
      },
      POST: async ({ request }: { request: Request }) => {
        try {
          const [{ getAuthService }, starterServer] = await Promise.all([
            import('~/auth/index.server'),
            import('~/utils/application-starter.server'),
          ])

          const rateLimit = await checkIpRateLimit(
            request,
            RATE_LIMITS.applicationStarter,
          )

          if (!rateLimit.allowed) {
            return rateLimitedResponse(rateLimit)
          }

          const requestGuardError = validateJsonRequest(request, {
            maxContentLength: MAX_APPLICATION_STARTER_BODY_BYTES,
          })
          if (requestGuardError) {
            return new Response(
              JSON.stringify({ error: requestGuardError.message }),
              {
                status: requestGuardError.status,
                headers: {
                  'Content-Type': 'application/json',
                  ...Object.fromEntries(rateLimit.headers.entries()),
                },
              },
            )
          }

          const bodyResult = await readJsonBody(request, {
            maxContentLength: MAX_APPLICATION_STARTER_BODY_BYTES,
          })
          if (!bodyResult.success) {
            return new Response(
              JSON.stringify({ error: bodyResult.error.message }),
              {
                status: bodyResult.error.status,
                headers: {
                  'Content-Type': 'application/json',
                  ...Object.fromEntries(rateLimit.headers.entries()),
                },
              },
            )
          }

          const rawBody = bodyResult.body
          const isAnalyzeRequest =
            isRecord(rawBody) && rawBody.mode === 'analyze'
          const body = starterServer.applicationStarterRequestSchema.parse(rawBody)

          const authService = getAuthService()
          const user = await authService.getCurrentUser(request)

          if (!user && !isAnalyzeRequest) {
            const anonymousQuota = await checkIpWindowRateLimit(
              request,
              RATE_LIMITS.applicationStarterAnonymousDaily,
            )

            if (!anonymousQuota.allowed) {
              return new Response(
                JSON.stringify({
                  code: 'LOGIN_REQUIRED_FOR_MORE_GENERATIONS',
                  error: 'Anonymous generation limit reached',
                  limit: RATE_LIMITS.applicationStarterAnonymousDaily.limit,
                  loginRequired: true,
                  retryAfter: Math.ceil(
                    (anonymousQuota.resetAt.getTime() - Date.now()) / 1000,
                  ),
                }),
                {
                  status: 429,
                  headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(rateLimit.headers.entries()),
                    ...Object.fromEntries(anonymousQuota.headers.entries()),
                  },
                },
              )
            }
          }

          const response = isAnalyzeRequest
            ? await starterServer.analyzeApplicationStarterServer({
                data: body,
              })
            : await starterServer.resolveApplicationStarterServer({
                data: body,
              })

          return new Response(JSON.stringify(response), {
            headers: {
              'Cache-Control': 'no-store',
              'Content-Type': 'application/json',
              ...Object.fromEntries(rateLimit.headers.entries()),
            },
          })
        } catch (error) {
          console.error('Error resolving application starter:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to resolve application starter',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
