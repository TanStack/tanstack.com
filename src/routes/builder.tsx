import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'

export const Route = createFileRoute({
  component: RouteComponent,
  loader: async (opts) => {
    await opts.context.queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentUser, {})
    )
  },
})

function RouteComponent() {
  const { isLoading, data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))
  const navigate = useNavigate()
  if (isLoading) {
    return null
  }
  if (!user?.capabilities.includes('builder')) {
    navigate({ to: '/login' })
    return null
  }

  return (
    <div className="flex items-center justify-center h-screen">
      Hello "/builder"!
    </div>
  )
}
