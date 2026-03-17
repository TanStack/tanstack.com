import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import * as v from 'valibot'
import {
  getAuthService,
  getSessionService,
  getUserRepository,
  SESSION_DURATION_MS,
} from '~/auth/index.server'
import { authorizeCliTicket, getCliTicket } from '~/auth/cli-tickets.server'
import { getCurrentUser } from '~/utils/auth.server'
import { SignInForm } from '~/routes/login'

const searchSchema = v.object({
  ticket: v.string(),
})

const authorizeCliSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { ticketId: string }) => data)
  .handler(async ({ data: { ticketId } }) => {
    const request = getRequest()

    // Verify ticket is still valid
    const ticket = getCliTicket(ticketId)
    if (!ticket) {
      return { status: 'invalid' as const }
    }

    // Check session
    const authService = getAuthService()
    const user = await authService.getCurrentUser(request)
    if (!user) {
      return { status: 'unauthenticated' as const }
    }

    // Fetch the full DB user for sessionVersion
    const userRepository = getUserRepository()
    const dbUser = await userRepository.findById(user.userId)
    if (!dbUser) {
      return { status: 'invalid' as const }
    }

    // Mint a fresh session token
    const sessionService = getSessionService()
    const expiresAt = Date.now() + SESSION_DURATION_MS
    const sessionToken = await sessionService.signCookie({
      userId: dbUser.id,
      expiresAt,
      version: dbUser.sessionVersion,
    })

    const authorized = authorizeCliTicket(ticketId, dbUser.id, sessionToken)
    if (!authorized) {
      return { status: 'invalid' as const }
    }

    return { status: 'authorized' as const, name: user.name ?? user.email }
  })

export const Route = createFileRoute('/auth/cli')({
  validateSearch: searchSchema,
  loader: async ({ location }) => {
    const { ticket: ticketId } = location.search as { ticket: string }

    // Check if user is already logged in
    const user = await getCurrentUser()
    if (!user) {
      return { status: 'unauthenticated' as const, ticketId }
    }

    // User is logged in — authorize the ticket
    return authorizeCliSession({ data: { ticketId } })
  },
  component: CliAuthPage,
})

function CliAuthPage() {
  const data = Route.useLoaderData()
  const { ticket: ticketId } = Route.useSearch()

  if (data.status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-sm mx-auto text-center p-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Invalid or Expired Request
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            This CLI auth link has expired or is invalid. Run{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">
              pnpm auth:login
            </code>{' '}
            to start a new session.
          </p>
        </div>
      </div>
    )
  }

  if (data.status === 'authorized') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-sm mx-auto text-center p-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            CLI Authorized
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Signed in as <strong>{data.name}</strong>. You can close this tab —
            your terminal is now authenticated.
          </p>
        </div>
      </div>
    )
  }

  // unauthenticated — show sign-in form, return here after OAuth
  const returnTo = `/auth/cli?ticket=${ticketId}`

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Sign in to authorize your CLI session.
          </p>
          <SignInForm returnTo={returnTo} />
        </div>
      </div>
    </div>
  )
}
