import { createFileRoute } from '@tanstack/react-router'
import {
  checkIpWindowRateLimit,
  checkIpRateLimit,
  getIpWindowRateLimitStatus,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'

export const Route = createFileRoute('/api/application-starter/resolve')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
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

          const requestGuardError = validateApplicationStarterRequest(request)
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

          const rawBody = await request.json()
          const isAnalyzeRequest =
            typeof rawBody === 'object' &&
            rawBody !== null &&
            rawBody.mode === 'analyze'
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
              details: error instanceof Error ? error.message : String(error),
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

function validateApplicationStarterRequest(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return {
      message: 'Request body too large',
      status: 413,
    }
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      message: 'Expected application/json request body',
      status: 415,
    }
  }

  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const secFetchSite = request.headers.get('sec-fetch-site')

  if (origin && origin !== requestUrl.origin) {
    return {
      message: 'Cross-origin requests are not allowed',
      status: 403,
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.origin !== requestUrl.origin) {
        return {
          message: 'Cross-origin requests are not allowed',
          status: 403,
        }
      }
    } catch {
      return {
        message: 'Invalid referer header',
        status: 400,
      }
    }
  }

  if (
    secFetchSite &&
    !['none', 'same-origin', 'same-site'].includes(secFetchSite)
  ) {
    return {
      message: 'Cross-site requests are not allowed',
      status: 403,
    }
  }

  return null
}
