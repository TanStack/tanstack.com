import { createFileRoute, Outlet, Link, redirect } from '@tanstack/react-router'
import { requireAuth } from '~/utils/auth.server'

export const Route = createFileRoute('/_libraries/account')({
  component: AccountLayout,
  beforeLoad: async () => {
    // Call server function directly from beforeLoad (works in both SSR and client)
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
})

function AccountLayout() {
  return (
    <div className="min-h-screen mx-auto p-4 md:p-8 w-full">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold mb-6">My Account</h2>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-6" aria-label="Account tabs">
            <Link
              to="/account"
              activeOptions={{ exact: true }}
              className="pb-4 px-1 border-b-2 font-medium text-sm transition-colors"
              activeProps={{
                className: 'border-blue-600 text-blue-600 dark:text-blue-400',
              }}
              inactiveProps={{
                className:
                  'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
              }}
            >
              Settings
            </Link>
            <Link
              to="/account/notes"
              className="pb-4 px-1 border-b-2 font-medium text-sm transition-colors"
              activeProps={{
                className: 'border-blue-600 text-blue-600 dark:text-blue-400',
              }}
              inactiveProps={{
                className:
                  'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
              }}
            >
              Notes
            </Link>
            <Link
              to="/account/feedback"
              className="pb-4 px-1 border-b-2 font-medium text-sm transition-colors"
              activeProps={{
                className: 'border-blue-600 text-blue-600 dark:text-blue-400',
              }}
              inactiveProps={{
                className:
                  'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
              }}
            >
              Feedback
            </Link>
          </nav>
        </div>

        {/* Page Content */}
        <Outlet />
      </div>
    </div>
  )
}
