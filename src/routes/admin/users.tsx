import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  FaUser,
  FaEdit,
  FaSave,
  FaTimes,
  FaLock,
  FaSpinner,
} from 'react-icons/fa'
import { PaginationControls } from '~/components/PaginationControls'
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

// Component to display/edit user roles (now uses bulk data)
function UserRolesCell({
  userId,
  editingUserId,
  editingRoleIds,
  toggleRole,
  allRoles,
  userRoles,
}: {
  userId: string
  editingUserId: string | null
  editingRoleIds: string[]
  toggleRole: (roleId: string) => void
  allRoles: Array<{ _id: string; name: string }>
  userRoles?: Array<{ _id: string; name: string }>
}) {
  if (editingUserId === userId) {
    return (
      <div className="space-y-2 max-w-xs">
        {allRoles.map((role) => (
          <label key={role._id} className="flex items-center">
            <input
              type="checkbox"
              checked={editingRoleIds.includes(role._id)}
              onChange={() => toggleRole(role._id)}
              className="mr-2"
            />
            <span className="text-sm text-gray-900 dark:text-white">
              {role.name}
            </span>
          </label>
        ))}
        {allRoles.length === 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            No roles available
          </span>
        )}
      </div>
    )
  }

  if (userRoles === undefined) {
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Loading...
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(userRoles || []).map((role) => (
        <span
          key={role._id}
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
        >
          {role.name}
        </span>
      ))}
      {(!userRoles || userRoles.length === 0) && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          No roles
        </span>
      )}
    </div>
  )
}

// Component to display effective capabilities (now uses bulk data)
function EffectiveCapabilitiesCell({
  userId,
  effectiveCapabilities,
}: {
  userId: string
  effectiveCapabilities?: string[]
}) {
  if (effectiveCapabilities === undefined) {
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Loading...
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(effectiveCapabilities || []).map((capability: string) => (
        <span
          key={capability}
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        >
          {capability}
        </span>
      ))}
      {(!effectiveCapabilities || effectiveCapabilities.length === 0) && (
        <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
      )}
    </div>
  )
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
  const [editingRoleIds, setEditingRoleIds] = useState<string[]>([])
  const [updatingAdsUserId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [bulkActionRoleId, setBulkActionRoleId] = useState<string | null>(null)

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
  const assignRolesToUser = useConvexMutation(api.roles.assignRolesToUser)
  const bulkAssignRolesToUsers = useConvexMutation(
    api.roles.bulkAssignRolesToUsers
  )
  const bulkUpdateUserCapabilities = useConvexMutation(
    api.users.bulkUpdateUserCapabilities
  )
  const allRoles = useConvexQuery(api.roles.listRoles, {})

  // Bulk fetch user roles and effective capabilities to avoid N+1 queries
  const userIds = useMemo(
    () => (usersQuery?.data?.page || []).map((u: User) => u._id),
    [usersQuery?.data?.page]
  )
  const bulkUserRoles = useConvexQuery(
    api.roles.getBulkUserRoles,
    userIds.length > 0 ? { userIds: userIds as Id<'users'>[] } : 'skip'
  )
  const bulkEffectiveCapabilities = useConvexQuery(
    api.roles.getBulkEffectiveCapabilities,
    userIds.length > 0 ? { userIds: userIds as Id<'users'>[] } : 'skip'
  )

  const availableCapabilities = useMemo(
    () => ['admin', 'disableAds', 'builder'],
    []
  )

  const handleEditUser = useCallback((user: User) => {
    setEditingUserId(user._id)
    setEditingCapabilities(user.capabilities || [])
    setEditingRoleIds([])
  }, [])

  // Fetch user roles when editing starts
  // Always call hook (React requirement)
  // Pass userId only if it's valid, otherwise pass undefined (query handles it)
  const validEditingUserId =
    editingUserId &&
    typeof editingUserId === 'string' &&
    editingUserId.trim() !== ''
      ? (editingUserId as Id<'users'>)
      : undefined
  const editingUserRoles = useConvexQuery(api.roles.getUserRoles, {
    userId: validEditingUserId,
  })

  useEffect(() => {
    if (editingUserRoles && editingUserId) {
      setEditingRoleIds(editingUserRoles.map((r) => r._id))
    } else if (!editingUserId) {
      setEditingRoleIds([])
    }
  }, [editingUserRoles, editingUserId])

  const handleSaveUser = useCallback(async () => {
    if (!editingUserId) return

    try {
      await Promise.all([
        updateUserCapabilities({
          userId: editingUserId as Id<'users'>,
          capabilities: editingCapabilities as (
            | 'admin'
            | 'disableAds'
            | 'builder'
          )[],
        }),
        assignRolesToUser({
          userId: editingUserId as Id<'users'>,
          roleIds: editingRoleIds as Id<'roles'>[],
        }),
      ])
      setEditingUserId(null)
      setEditingRoleIds([])
    } catch (error) {
      console.error('Failed to update user:', error)
      alert(error instanceof Error ? error.message : 'Failed to update user')
    }
  }, [
    editingUserId,
    editingCapabilities,
    editingRoleIds,
    updateUserCapabilities,
    assignRolesToUser,
  ])

  const handleCancelEdit = useCallback(() => {
    setEditingUserId(null)
    setEditingCapabilities([])
    setEditingRoleIds([])
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

  const toggleRole = useCallback(
    (roleId: string) => {
      if (editingRoleIds.includes(roleId)) {
        setEditingRoleIds(editingRoleIds.filter((id) => id !== roleId))
      } else {
        setEditingRoleIds([...editingRoleIds, roleId])
      }
    },
    [editingRoleIds]
  )

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
    [selectedUserIds]
  )

  const toggleAllSelection = useCallback(() => {
    const users = usersQuery?.data?.page || []
    if (selectedUserIds.size === users.length && users.length > 0) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(users.map((u: User) => u._id)))
    }
  }, [selectedUserIds, usersQuery])

  const handleBulkAssignRole = useCallback(async () => {
    if (selectedUserIds.size === 0 || !bulkActionRoleId) return

    try {
      await bulkAssignRolesToUsers({
        userIds: Array.from(selectedUserIds) as Id<'users'>[],
        roleIds: [bulkActionRoleId as Id<'roles'>],
      })
      setSelectedUserIds(new Set())
      setBulkActionRoleId(null)
    } catch (error) {
      console.error('Failed to assign role to users:', error)
      alert(error instanceof Error ? error.message : 'Failed to assign role')
    }
  }, [selectedUserIds, bulkActionRoleId, bulkAssignRolesToUsers])

  const handleBulkUpdateCapabilities = useCallback(
    async (capabilities: string[]) => {
      if (selectedUserIds.size === 0) return

      if (
        !window.confirm(
          `Update capabilities for ${selectedUserIds.size} user(s)?`
        )
      ) {
        return
      }

      try {
        await bulkUpdateUserCapabilities({
          userIds: Array.from(selectedUserIds) as Id<'users'>[],
          capabilities: capabilities as ('admin' | 'disableAds' | 'builder')[],
        })
        setSelectedUserIds(new Set())
      } catch (error) {
        console.error('Failed to update user capabilities:', error)
        alert(
          error instanceof Error
            ? error.message
            : 'Failed to update capabilities'
        )
      }
    },
    [selectedUserIds, bulkUpdateUserCapabilities]
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
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={
              usersQuery?.data?.page
                ? selectedUserIds.size === usersQuery.data.page.length &&
                  usersQuery.data.page.length > 0
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
                  None
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: ({ row }) => {
          const user = row.original
          if (!user._id)
            return (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                -
              </span>
            )
          return (
            <UserRolesCell
              userId={user._id}
              editingUserId={editingUserId}
              editingRoleIds={editingRoleIds}
              toggleRole={toggleRole}
              allRoles={allRoles || []}
              userRoles={bulkUserRoles?.[user._id]}
            />
          )
        },
      },
      {
        id: 'effectiveCapabilities',
        header: 'Effective Capabilities',
        cell: ({ row }) => {
          const user = row.original
          if (!user._id)
            return (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                -
              </span>
            )
          return (
            <EffectiveCapabilitiesCell
              userId={user._id}
              effectiveCapabilities={bulkEffectiveCapabilities?.[user._id]}
            />
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
      editingRoleIds,
      availableCapabilities,
      handleSaveUser,
      handleCancelEdit,
      handleEditUser,
      toggleCapability,
      toggleRole,
      handleToggleAdsDisabled,
      updatingAdsUserId,
      allRoles,
      selectedUserIds,
      toggleUserSelection,
      toggleAllSelection,
      usersQuery,
      bulkUserRoles,
      bulkEffectiveCapabilities,
    ]
  )

  // Pagination state
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
  // Check effective capabilities (direct + role-based)
  const effectiveCapabilities =
    (user as any)?.effectiveCapabilities || user?.capabilities || []
  const canAdmin = effectiveCapabilities.includes('admin')
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
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Manage Users
            </h1>
            {usersQuery.isFetching && (
              <FaSpinner className="animate-spin text-gray-500 dark:text-gray-400" />
            )}
          </div>

          {selectedUserIds.size > 0 && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedUserIds.size} user(s) selected
                </span>
                <button
                  onClick={() => setSelectedUserIds(new Set())}
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Assign Role:
                  </label>
                  <select
                    value={bulkActionRoleId || ''}
                    onChange={(e) =>
                      setBulkActionRoleId(e.target.value || null)
                    }
                    className="px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a role...</option>
                    {(allRoles || []).map((role) => (
                      <option key={role._id} value={role._id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssignRole}
                    disabled={!bulkActionRoleId}
                    className="px-4 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Assign
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Set Capabilities:
                  </label>
                  {availableCapabilities.map((capability) => (
                    <button
                      key={capability}
                      onClick={() => handleBulkUpdateCapabilities([capability])}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Add {capability}
                    </button>
                  ))}
                  <button
                    onClick={() => handleBulkUpdateCapabilities([])}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pagination Controls - Top */}
          <div className="mb-4">
            <PaginationControls
              currentPage={currentPageIndex}
              totalPages={Math.max(
                1,
                Math.ceil((usersQuery?.data?.counts?.filtered ?? 0) / pageSize)
              )}
              totalItems={usersQuery?.data?.counts?.total ?? 0}
              filteredItems={usersQuery?.data?.counts?.filtered}
              pageSize={pageSize}
              onPageChange={(page) => {
                navigate({
                  resetScroll: false,
                  search: (prev) => ({ ...prev, page }),
                })
              }}
              onPageSizeChange={(newPageSize) => {
                navigate({
                  resetScroll: false,
                  search: (prev) => ({
                    ...prev,
                    pageSize: newPageSize,
                    page: 0,
                  }),
                })
              }}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              itemLabel="users"
            />
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="hidden md:table-header-group">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black/50"
                  >
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap"
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
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-black/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
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

          {/* Pagination Controls - Bottom */}
          {usersQuery?.data && usersQuery.data.page.length > 0 && (
            <div className="mt-4">
              <PaginationControls
                currentPage={currentPageIndex}
                totalPages={Math.max(
                  1,
                  Math.ceil(
                    (usersQuery?.data?.counts?.filtered ?? 0) / pageSize
                  )
                )}
                totalItems={usersQuery?.data?.counts?.total ?? 0}
                filteredItems={usersQuery?.data?.counts?.filtered}
                pageSize={pageSize}
                onPageChange={(page) => {
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({ ...prev, page }),
                  })
                }}
                onPageSizeChange={(newPageSize) => {
                  navigate({
                    resetScroll: false,
                    search: (prev) => ({
                      ...prev,
                      pageSize: newPageSize,
                      page: 0,
                    }),
                  })
                }}
                canGoPrevious={canGoPrevious}
                canGoNext={canGoNext}
                itemLabel="users"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
