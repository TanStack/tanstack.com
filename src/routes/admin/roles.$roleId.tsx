import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo, useCallback } from 'react'
import { FaTrash, FaUser, FaUsers } from 'react-icons/fa'
import { useRemoveUsersFromRole } from '~/utils/mutations'
import { useQuery } from '@tanstack/react-query'
import { getRole, getUsersWithRole } from '~/utils/roles.functions'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { ArrowLeft, Lock } from 'lucide-react'

export const Route = createFileRoute('/admin/roles/$roleId')({
  component: RoleDetailPage,
})

type User = {
  _id: string
  email: string
  name?: string
  displayUsername?: string
  image?: string
  capabilities?: string[]
}

function RoleDetailPage() {
  const { roleId } = Route.useParams()
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [confirmRemove, setConfirmRemove] = useState<{
    userId: string
    name: string
  } | null>(null)

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const roleQuery = useQuery({
    queryKey: ['admin', 'role', roleId],
    queryFn: async () => {
      return getRole({ data: { roleId } })
    },
  })
  const role = roleQuery.data
  const usersWithRoleQuery = useQuery({
    queryKey: ['admin', 'usersWithRole', roleId],
    queryFn: async () => {
      return getUsersWithRole({ data: { roleId } })
    },
  })
  const usersWithRole = usersWithRoleQuery.data
  const removeUsersFromRole = useRemoveUsersFromRole()

  const handleRemoveUsers = useCallback(async () => {
    if (selectedUserIds.size === 0) return

    try {
      await removeUsersFromRole.mutateAsync({
        roleId: roleId,
        userIds: Array.from(selectedUserIds),
      })
      setSelectedUserIds(new Set())
    } catch (error) {
      console.error(
        'Failed to remove users from role:',
        error instanceof Error ? error.message : 'Unknown error',
      )
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to remove users from role',
      )
    }
  }, [selectedUserIds, roleId, removeUsersFromRole])

  const toggleUserSelection = useCallback(
    (userId: string) => {
      const newSelection = new Set(selectedUserIds)
      if (newSelection.has(userId)) {
        newSelection.delete(userId)
      } else {
        newSelection.add(userId)
      }
      setSelectedUserIds(newSelection)
    },
    [selectedUserIds],
  )

  const toggleAllSelection = useCallback(() => {
    if (!usersWithRole) return
    if (selectedUserIds.size === usersWithRole.length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(usersWithRole.map((u) => u._id)))
    }
  }, [selectedUserIds, usersWithRole])

  const columns = useMemo<ColumnDef<User, any>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={
              usersWithRole
                ? selectedUserIds.size === usersWithRole.length &&
                  usersWithRole.length > 0
                : false
            }
            onChange={toggleAllSelection}
            className="h-4 w-4 accent-blue-600"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedUserIds.has(row.original._id)}
            onChange={() => toggleUserSelection(row.original._id)}
            className="h-4 w-4 accent-blue-600"
          />
        ),
      },
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => {
          const user = row.original
          const displayName = user.name || user.displayUsername || ''
          return (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10">
                {user.image ? (
                  <img
                    className="h-10 w-10 rounded-full"
                    src={user.image}
                    alt=""
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <FaUser className="text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
              {displayName && (
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {displayName}
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <div className="text-sm text-gray-900 dark:text-white">
            {getValue() as string}
          </div>
        ),
      },
      {
        id: 'capabilities',
        header: 'Direct Capabilities',
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="flex flex-wrap gap-1">
              {(user.capabilities || []).map((capability: string) => (
                <span
                  key={capability}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {capability}
                </span>
              ))}
              {(!user.capabilities || user.capabilities.length === 0) && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  None
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original
          return (
            <button
              onClick={() => {
                setConfirmRemove({
                  userId: user._id,
                  name: user.name || user.email,
                })
              }}
              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
            >
              <FaTrash className="w-4 h-4" />
            </button>
          )
        },
      },
    ],
    [selectedUserIds, usersWithRole, toggleAllSelection, toggleUserSelection],
  )

  const table = useReactTable({
    data: usersWithRole || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  const capabilities = user?.capabilities || []
  const canAdmin = capabilities.includes('admin')
  if (user && !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="text-4xl text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
        </div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Role Not Found</h1>
          <Link
            to="/admin/roles"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Roles
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link
              to="/admin/roles"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {role.name}
              </h1>
              {role.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {role.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <FaUsers className="w-5 h-5" />
            <span className="text-sm">
              {usersWithRole?.length || 0} user(s) with this role
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {role.capabilities.map((capability) => (
              <span
                key={capability}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>

        {selectedUserIds.size > 0 && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedUserIds.size} user(s) selected
            </span>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${selectedUserIds.size} user(s) from this role?`,
                  )
                ) {
                  handleRemoveUsers()
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove from Role
            </button>
          </div>
        )}

        {confirmRemove && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Removal
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Remove {confirmRemove.name} from role &quot;{role?.name}&quot;?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmRemove(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await removeUsersFromRole.mutateAsync({
                        roleId: roleId,
                        userIds: [confirmRemove.userId],
                      })
                      setConfirmRemove(null)
                    } catch (error) {
                      console.error(
                        'Failed to remove user from role:',
                        error instanceof Error
                          ? error.message
                          : 'Unknown error',
                      )
                      alert(
                        error instanceof Error
                          ? error.message
                          : 'Failed to remove user',
                      )
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedUserIds.has(row.original._id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!usersWithRole || usersWithRole.length === 0) && (
            <div className="text-center py-12">
              <FaUsers className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No users with this role
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Users assigned to this role will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
