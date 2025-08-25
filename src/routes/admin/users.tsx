import { redirect, Link } from '@tanstack/react-router'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
  useConvex,
} from 'convex/react'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useState, useMemo, useCallback } from 'react'
import {
  FaUser,
  FaEdit,
  FaSave,
  FaTimes,
  FaLock,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa'
import type { Id } from 'convex/_generated/dataModel'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { convexQuery } from '@convex-dev/react-query'

// User type for table
type User = {
  _id: string
  email: string
  image?: string
  capabilities?: string[]
}

export const Route = createFileRoute({
  component: UsersPage,
})

function UsersPage() {
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingCapabilities, setEditingCapabilities] = useState<string[]>([])
  const [cursors, setCursors] = useState<string[]>(['']) // Track cursor history for navigation
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  const user = useConvexQuery(api.auth.getCurrentUser)
  const usersQuery = useQuery({
    ...convexQuery(api.users.listUsers, {
      pagination: {
        limit: 10,
        cursor: cursors[currentPageIndex] || null,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const updateUserCapabilities = useConvexMutation(
    api.users.updateUserCapabilities
  )

  const availableCapabilities = useMemo(
    () => ['admin', 'disableAds', 'builder'],
    []
  )

  const handleEditUser = useCallback((user: User) => {
    setEditingUserId(user._id)
    setEditingCapabilities(user.capabilities || [])
  }, [])

  const handleSaveUser = useCallback(async () => {
    if (!editingUserId) return

    try {
      await updateUserCapabilities({
        userId: editingUserId as Id<'users'>,
        capabilities: editingCapabilities as (
          | 'admin'
          | 'disableAds'
          | 'builder'
        )[],
      })
      setEditingUserId(null)
    } catch (error) {
      console.error('Failed to update user capabilities:', error)
    }
  }, [editingUserId, editingCapabilities, updateUserCapabilities])

  const handleCancelEdit = useCallback(() => {
    setEditingUserId(null)
    setEditingCapabilities([])
  }, [])

  const toggleCapability = useCallback(
    (capability: string) => {
      if (editingCapabilities.includes(capability)) {
        setEditingCapabilities(
          editingCapabilities.filter((c) => c !== capability)
        )
      } else {
        setEditingCapabilities([...editingCapabilities, capability])
      }
    },
    [editingCapabilities]
  )

  // Define columns using the column helper
  const columns = useMemo<ColumnDef<User, any>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              {row.original.image ? (
                <img
                  className="h-10 w-10 rounded-full"
                  src={row.original.image}
                  alt=""
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  <FaUser className="text-gray-500 dark:text-gray-400" />
                </div>
              )}
            </div>
          </div>
        ),
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
        header: 'Capabilities',
        cell: ({ row }) => {
          const user = row.original
          return editingUserId === user._id ? (
            <div className="space-y-2">
              {availableCapabilities.map((capability) => (
                <label key={capability} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingCapabilities.includes(capability)}
                    onChange={() => toggleCapability(capability)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {capability}
                  </span>
                </label>
              ))}
            </div>
          ) : (
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
                  No capabilities
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
          return editingUserId === user._id ? (
            <div className="flex space-x-2">
              <button
                onClick={handleSaveUser}
                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
              >
                <FaSave className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleEditUser(user)}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <FaEdit className="w-4 h-4" />
            </button>
          )
        },
      },
    ],
    [
      editingUserId,
      editingCapabilities,
      availableCapabilities,
      handleSaveUser,
      handleCancelEdit,
      handleEditUser,
      toggleCapability,
    ]
  )

  // Pagination handlers
  const goToNextPage = () => {
    if (usersQuery?.data?.continueCursor) {
      const newPageIndex = currentPageIndex + 1

      // Add new cursor to history if we don't have it
      if (cursors.length <= newPageIndex) {
        setCursors((prev) => [...prev, usersQuery.data.continueCursor!])
      }

      setCurrentPageIndex(newPageIndex)
    }
  }

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }

  const canGoPrevious = currentPageIndex > 0
  const canGoNext = !usersQuery?.data?.isDone

  // Create table instance
  const table = useReactTable({
    data: usersQuery?.data?.page || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

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

  if (!usersQuery) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded mb-4 w-64"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to="/admin"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Admin Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage user accounts and their capabilities.
          </p>
        </div>

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
                              header.getContext()
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
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!usersQuery.data || usersQuery.data?.page.length === 0) && (
            <div className="text-center py-12">
              <FaUser className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No users found
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                There are currently no users in the system.
              </p>
            </div>
          )}
        </div>

        {/* Cursor-based pagination controls */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPageIndex + 1}
            {usersQuery.data && (
              <span> • {usersQuery.data.page?.length} users</span>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={goToPreviousPage}
              disabled={!canGoPrevious}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaChevronLeft className="w-3 h-3 mr-1" />
              Previous
            </button>
            <button
              onClick={goToNextPage}
              disabled={!canGoNext}
              className="flex items-center px-3 py-2 ml-3 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <FaChevronRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
