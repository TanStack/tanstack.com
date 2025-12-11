import { Link, createFileRoute } from '@tanstack/react-router'
import {
  FaLock,
  FaUsers,
  FaRss,
  FaShieldAlt,
  FaGithub,
  FaNpm,
} from 'react-icons/fa'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
})

function AdminPage() {
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const capabilities = useCapabilities()

  // If not authenticated, show loading
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  // If authenticated but no admin capability, show unauthorized
  const canAdmin = capabilities.includes('admin')
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
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back,{' '}
            {user && typeof user === 'object' && 'name' in user
              ? user.name
              : 'Admin'}
            . Manage your TanStack platform from here.
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
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <FaShieldAlt className="text-purple-600 dark:text-purple-400 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Role Management
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create and manage roles, assign capabilities to roles, and view
              users by role.
            </p>
            <Link
              to="/admin/roles"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Manage Roles
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FaRss className="text-green-600 dark:text-green-400 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Feed Management
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Manage feed entries, sync GitHub releases and blog posts, and
              create manual announcements.
            </p>
            <Link
              to="/admin/feed"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Manage Feed
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                  <FaGithub className="text-gray-900 dark:text-gray-100 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  GitHub Stats
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              View and refresh cached GitHub statistics for repositories and
              organizations.
            </p>
            <Link
              to="/admin/github-stats"
              className="inline-flex items-center px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              Manage GitHub Stats
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <FaNpm className="text-red-600 dark:text-red-400 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  NPM Stats
                </h3>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              View and refresh cached NPM package statistics and org-level
              aggregates.
            </p>
            <Link
              to="/admin/npm-stats"
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Manage NPM Stats
            </Link>
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
