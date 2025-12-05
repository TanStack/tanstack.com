import { createFileRoute } from '@tanstack/react-router'
import { getSessionCookie, verifyCookie } from '~/utils/cookies.server'
import { revokeUserSessions } from '~/utils/users.server'

export const Route = createFileRoute('/auth/signout')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Read and verify signed cookie
        const signedCookie = getSessionCookie(request)

        if (signedCookie) {
          const cookieData = await verifyCookie(signedCookie)

          // Revoke all sessions for this user (increment sessionVersion)
          if (cookieData) {
            try {
              await revokeUserSessions({ data: { userId: cookieData.userId } })
            } catch (error) {
              // Log but don't fail if revocation fails
              console.error('Failed to revoke sessions:', error)
            }
          }
        }

        // Clear session cookie
        const clearCookie =
          'session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'

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
