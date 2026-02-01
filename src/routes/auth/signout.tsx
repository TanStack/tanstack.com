import { createFileRoute } from '@tanstack/react-router'
import { getSessionService, getUserRepository } from '~/auth/index.server'

export const Route = createFileRoute('/auth/signout')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const sessionService = getSessionService()
        const userRepository = getUserRepository()

        // Read and verify signed cookie
        const signedCookie = sessionService.getSessionCookie(request)

        if (signedCookie) {
          const cookieData = await sessionService.verifyCookie(signedCookie)

          // Revoke all sessions for this user (increment sessionVersion)
          if (cookieData) {
            try {
              await userRepository.incrementSessionVersion(cookieData.userId)
            } catch (error) {
              // Log but don't fail if revocation fails
              console.error(
                'Failed to revoke sessions:',
                error instanceof Error ? error.message : 'Unknown error',
              )
            }
          }
        }

        // Clear session cookie
        const clearCookie = sessionService.createClearSessionCookieHeader()

        // Return Response with Set-Cookie header and redirect
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
