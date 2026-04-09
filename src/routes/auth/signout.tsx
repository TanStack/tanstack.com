import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/signout')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [{ getSessionService, getUserRepository }] = await Promise.all([
          import('~/auth/index.server'),
        ])
        const sessionService = getSessionService()
        const userRepository = getUserRepository()

        const signedCookie = sessionService.getSessionCookie(request)

        if (signedCookie) {
          const cookieData = await sessionService.verifyCookie(signedCookie)

          if (cookieData) {
            try {
              await userRepository.incrementSessionVersion(cookieData.userId)
            } catch (error) {
              console.error(
                'Failed to revoke sessions:',
                error instanceof Error ? error.message : 'Unknown error',
              )
            }
          }
        }

        const clearCookie = sessionService.createClearSessionCookieHeader()
        const loginUrl = new URL('/login', request.url).toString()

        return new Response(null, {
          status: 302,
          headers: {
            Location: loginUrl,
            'Set-Cookie': clearCookie,
          },
        })
      },
    },
  },
})
