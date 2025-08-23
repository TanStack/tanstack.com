import { Link } from '@tanstack/react-router'
import { FaLock, FaUsers, FaChartBar } from 'react-icons/fa'
import { useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'

export const Route = createFileRoute({
  component: AdminPage,
})

function AdminPage() {
  const user = useQuery(api.auth.getCurrentUser)

  // If not authenticated, show loading
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  // If authenticated but no admin capability, show unauthorized
  const canAdmin = user?.capabilities.includes('admin')
  if (user && !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaLock className="text-4xl text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
          <Link
            to="/"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return <AdminDashboard />
}

function AdminDashboard() {
  const user = useQuery(api.auth.getCurrentUser)

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back, {user?.name}. Manage your TanStack platform from here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FaUsers className="text-blue-600 dark:text-blue-400 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  User Management
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              View and manage user accounts, capabilities, and permissions.
            </p>
            <Link
              to="/admin/users"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage Users
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <FaLock className="text-gray-600 dark:text-gray-400 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Coming Soon
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Additional admin features will be added here.
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-lg cursor-not-allowed">
              Coming Soon
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <FaChartBar className="text-gray-600 dark:text-gray-400 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Analytics
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              View platform statistics and analytics (coming soon).
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-lg cursor-not-allowed">
              Coming Soon
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Main Site
          </Link>
        </div>
      </div>
    </div>
  )
}
