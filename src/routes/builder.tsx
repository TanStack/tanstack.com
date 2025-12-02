import { createFileRoute } from '@tanstack/react-router'
import { useCapabilities } from '~/hooks/useCapabilities'

export const Route = createFileRoute('/builder')({
  component: RouteComponent,
  loader: async (opts) => {
    const user = await opts.context.ensureUser()
    return { user }
  },
})

function RouteComponent() {
  const capabilities = useCapabilities()

  const canAccess = capabilities.includes('builder')

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
