import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
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
import { z } from 'zod'

// User type for table
type User = {
  _id: string
  email: string
  name?: string
  displayUsername?: string
  image?: string
  capabilities?: string[]
  adsDisabled?: boolean
  interestedInHidingAds?: boolean
}

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
  validateSearch: z.object({
    email: z.string().optional(),
    name: z.string().optional(),
    cap: z.union([z.string(), z.array(z.string())]).optional(),
    noCapabilities: z.boolean().optional(),
    ads: z.enum(['all', 'true', 'false']).optional(),
    waitlist: z.enum(['all', 'true', 'false']).optional(),
    page: z.number().int().nonnegative().optional(),
    pageSize: z.number().int().positive().optional(),
  }),
})

function UsersPage() {
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingCapabilities, setEditingCapabilities] = useState<string[]>([])
  const [updatingAdsUserId] = useState<string | null>(null)

  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const emailFilter = search.email ?? ''
  const nameFilter = search.name ?? ''
  const capabilityFilters = useMemo(
    () =>
      Array.isArray(search.cap) ? search.cap : search.cap ? [search.cap] : [],
    [search.cap]
  )
  const noCapabilitiesFilter = search.noCapabilities ?? false
  const adsDisabledFilter = (search.ads ?? 'all') as 'all' | 'true' | 'false'
  const waitlistFilter = (search.waitlist ?? 'all') as 'all' | 'true' | 'false'
  const currentPageIndex = search.page ?? 0

  const user = useConvexQuery(api.auth.getCurrentUser)
  const pageSize = search.pageSize ?? 10
  // Cast to any to avoid transient type mismatch until Convex codegen runs
  const listUsersRef: any = (api as any).users?.listUsers
  const usersQuery = useQuery({
    ...convexQuery(listUsersRef, {
      pagination: {
        limit: pageSize,
        page: currentPageIndex,
      },
      emailFilter: emailFilter || undefined,
      nameFilter: nameFilter || undefined,
      capabilityFilter:
        capabilityFilters.length > 0 ? capabilityFilters : undefined,
      noCapabilitiesFilter: noCapabilitiesFilter || undefined,
      adsDisabledFilter:
        adsDisabledFilter === 'all' ? undefined : adsDisabledFilter === 'true',
      interestedInHidingAdsFilter:
        waitlistFilter === 'all' ? undefined : waitlistFilter === 'true',
    }),
    placeholderData: keepPreviousData,
  })
  // counts now come from listUsers response

  const updateUserCapabilities = useConvexMutation(
    api.users.updateUserCapabilities
  )
  const adminSetAdsDisabled = useConvexMutation(api.users.adminSetAdsDisabled)

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

  const handleToggleAdsDisabled = useCallback(
    async (userId: string, nextValue: boolean) => {
      adminSetAdsDisabled({
        userId: userId as Id<'users'>,
        adsDisabled: nextValue,
      })
    },
    [adminSetAdsDisabled]
  )

  const handleCapabilityToggle = useCallback(
    (capability: string) => {
      const newFilters = capabilityFilters.includes(capability)
        ? capabilityFilters.filter((c) => c !== capability)
        : [...capabilityFilters, capability]
      navigate({
        resetScroll: false,
        search: (prev) => ({
          ...prev,
          cap: newFilters.length > 0 ? newFilters : undefined,
          page: 0,
        }),
      })
    },
    [capabilityFilters, navigate]
  )

  // Define columns using the column helper
  const columns = useMemo<ColumnDef<User, any>[]>(
    () => [
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
        id: 'adsDisabled',
        header: 'Ads Disabled',
        cell: ({ row }) => {
          const user = row.original
          const checked = Boolean(user.adsDisabled)
          return (
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                handleToggleAdsDisabled(user._id, e.target.checked)
              }
              disabled={updatingAdsUserId === user._id}
              className="h-4 w-4 accent-blue-600"
            />
          )
        },
      },
      {
        id: 'waitlist',
        header: 'On Ads Waitlist',
        cell: ({ row }) => {
          const user = row.original
          const onWaitlist = Boolean(user.interestedInHidingAds)
          return (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                onWaitlist
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {onWaitlist ? 'Yes' : 'No'}
            </span>
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
      handleToggleAdsDisabled,
      updatingAdsUserId,
    ]
  )

  // Pagination handlers via search state
  const goToNextPage = () => {
    if (!usersQuery?.data?.isDone) {
      navigate({
        resetScroll: false,
        search: (prev) => ({ ...prev, page: currentPageIndex + 1 }),
      })
    }
  }

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      navigate({
        resetScroll: false,
        search: (prev) => ({ ...prev, page: currentPageIndex - 1 }),
      })
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
    <div className="w-full p-4">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters */}
        <aside className="lg:w-64 lg:flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-4 sticky top-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Filters
            </h2>

            {/* Email Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => {
                  const value = e.target.value
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({
                      ...prev,
                      email: value || undefined,
                      page: 0,
                    }),
                  })
                }}
                placeholder="Filter by email"
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Name Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => {
                  const value = e.target.value
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({
                      ...prev,
                      name: value || undefined,
                      page: 0,
                    }),
                  })
                }}
                placeholder="Filter by name"
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Capabilities Filter - Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Capabilities
              </label>
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noCapabilitiesFilter}
                    onChange={(e) => {
                      navigate({
                        resetScroll: false,
                        search: (prev) => ({
                          ...prev,
                          noCapabilities: e.target.checked || undefined,
                          page: 0,
                        }),
                      })
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-white">
                    No capabilities
                  </span>
                </label>
                {availableCapabilities.map((cap) => (
                  <label key={cap} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capabilityFilters.includes(cap)}
                      onChange={() => handleCapabilityToggle(cap)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900 dark:text-white">
                      {cap}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ads Disabled Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ads Status
              </label>
              <select
                value={adsDisabledFilter}
                onChange={(e) => {
                  const value = e.target.value as 'all' | 'true' | 'false'
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({
                      ...prev,
                      ads: value,
                      page: 0,
                    }),
                  })
                }}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All ad statuses</option>
                <option value="true">Ads disabled</option>
                <option value="false">Ads enabled</option>
              </select>
            </div>

            {/* Waitlist Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ads Waitlist
              </label>
              <select
                value={waitlistFilter}
                onChange={(e) => {
                  const value = e.target.value as 'all' | 'true' | 'false'
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({
                      ...prev,
                      waitlist: value,
                      page: 0,
                    }),
                  })
                }}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All ads waitlist statuses</option>
                <option value="true">On ads waitlist</option>
                <option value="false">Not on ads waitlist</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Manage Users
          </h1>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            {/* Top compact page controls (no totals or page size) */}
            <div className="flex items-center justify-end p-2">
              <div className="flex gap-1 items-center">
                <button
                  onClick={goToPreviousPage}
                  disabled={!canGoPrevious}
                  aria-label="Previous page"
                  className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-1"
                >
                  <FaChevronLeft className="w-3 h-3" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={!canGoNext}
                  aria-label="Next page"
                  className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-1"
                >
                  <span className="hidden sm:inline">Next</span>
                  <FaChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
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
                        <td
                          key={cell.id}
                          className="px-6 py-4 whitespace-nowrap"
                        >
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {(() => {
                const filtered = usersQuery?.data?.counts?.filtered ?? 0
                const total = usersQuery?.data?.counts?.total ?? 0
                const totalPages = Math.max(1, Math.ceil(filtered / pageSize))
                return (
                  <>
                    Showing {filtered} of {total} users
                    <span>
                      {' '}
                      • Page {currentPageIndex + 1} of {totalPages}
                    </span>
                  </>
                )
              })()}
            </div>
            <div className="flex gap-1 items-center">
              <label className="text-sm text-gray-500 dark:text-gray-400">
                Per page:
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10)
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({ ...prev, pageSize: next, page: 0 }),
                  })
                }}
                className="px-2 py-1 text-sm border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                onClick={goToPreviousPage}
                disabled={!canGoPrevious}
                className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-1"
              >
                <FaChevronLeft className="w-3 h-3" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                onClick={goToNextPage}
                disabled={!canGoNext}
                className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <FaChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
