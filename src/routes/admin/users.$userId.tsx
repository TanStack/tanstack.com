import {
  createFileRoute,
  Link,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getUser } from '~/utils/users.server'
import { getUserRoles } from '~/utils/roles.functions'
import { getUserEffectiveCapabilities } from '~/utils/roles.functions'
import { ArrowLeft, User, Shield, Calendar, Mail, AtSign } from 'lucide-react'
import { requireCapability } from '~/utils/auth.server'
import { Card } from '~/components/Card'
import { format } from '~/utils/dates'

export const Route = createFileRoute('/admin/users/$userId')({
  beforeLoad: async () => {
    try {
      const user = await requireCapability({ data: { capability: 'admin' } })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: UserDetailPage,
})

function UserDetailPage() {
  const { userId } = Route.useParams()

  const userQuery = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => getUser({ data: { userId } }),
  })

  const rolesQuery = useQuery({
    queryKey: ['admin', 'user', userId, 'roles'],
    queryFn: () => getUserRoles({ data: { userId } }),
    enabled: !!userQuery.data,
  })

  const effectiveCapabilitiesQuery = useQuery({
    queryKey: ['admin', 'user', userId, 'effectiveCapabilities'],
    queryFn: () => getUserEffectiveCapabilities({ data: { userId } }),
    enabled: !!userQuery.data,
  })

  if (userQuery.isLoading) {
    return (
      <div className="w-full p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    )
  }

  const user = userQuery.data

  if (!user) {
    return (
      <div className="w-full p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              User not found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The user you're looking for doesn't exist.
            </p>
            <Link
              to="/admin/users"
              className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Users
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const displayName = user.name || user.displayUsername || user.email
  const roles = rolesQuery.data || []
  const effectiveCapabilities = effectiveCapabilitiesQuery.data || []

  return (
    <div className="w-full p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Users
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 h-16 w-16">
              {user.image || user.oauthImage ? (
                <img
                  className="h-16 w-16 rounded-full"
                  src={user.image || user.oauthImage || ''}
                  alt=""
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              User Information
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.email}
                </dd>
              </div>
              {user.name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Name
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user.name}
                  </dd>
                </div>
              )}
              {user.displayUsername && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <AtSign className="w-4 h-4" />
                    Display Username
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user.displayUsername}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Created
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {format(new Date(user.createdAt), 'PPpp')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Last Updated
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {format(new Date(user.updatedAt), 'PPpp')}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Capabilities & Roles */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissions
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Direct Capabilities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {user.capabilities && user.capabilities.length > 0 ? (
                    user.capabilities.map((cap: string) => (
                      <span
                        key={cap}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      None
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Roles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roles.length > 0 ? (
                    roles.map((role) => (
                      <Link
                        key={role._id}
                        to="/admin/roles/$roleId"
                        params={{ roleId: role._id }}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                      >
                        {role.name}
                      </Link>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      None
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Effective Capabilities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {effectiveCapabilities.length > 0 ? (
                    effectiveCapabilities.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      >
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      None
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Ads Status */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Ads Status
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Ads Disabled
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.adsDisabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {user.adsDisabled ? 'Yes' : 'No'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Interested in Hiding Ads
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.interestedInHidingAds
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {user.interestedInHidingAds ? 'Yes' : 'No'}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>

          {/* Session Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Session Info
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Session Version
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                  {user.sessionVersion}
                </dd>
              </div>
              {user.lastUsedFramework && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Last Used Framework
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {user.lastUsedFramework}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>

        {/* Actions */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Related
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/admin/audit"
              search={{
                targetType: 'user',
                actorId: undefined,
                action: undefined,
              }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View audit logs for this user →
            </Link>
            <Link
              to="/admin/logins"
              search={{ userId }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View login history →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
