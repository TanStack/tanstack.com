import { redirect, createFileRoute } from '@tanstack/react-router'
import { useCapabilities } from '~/hooks/useCapabilities'
import { requireCapability } from '~/utils/auth.server'

export const Route = createFileRoute('/builder')({
  component: RouteComponent,
  beforeLoad: async () => {
    // Call server function directly from beforeLoad (works in both SSR and client)
    try {
      const user = await requireCapability({ data: { capability: 'builder' } })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
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
