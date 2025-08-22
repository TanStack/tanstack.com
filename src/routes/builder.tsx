import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'

export const Route = createFileRoute({
  component: RouteComponent,
  loader: async (opts) => {
    const user = await opts.context.ensureUser()
    return { user }
  },
})

function RouteComponent() {
  const currentUserQuery = useSuspenseQuery(
    convexQuery(api.auth.getCurrentUser, {})
  )

  const canAccess = currentUserQuery.data?.capabilities.includes('builder')

  return (
    <div className="flex items-center justify-center h-screen">
      {canAccess ? (
        <Builder />
      ) : (
        <div>
          You are not authorized to access this page. Please contact support.
        </div>
      )}
    </div>
  )
}

function Builder() {
  return (
    <div>
      <h1>Welcome to the builder!</h1>
    </div>
  )
}
