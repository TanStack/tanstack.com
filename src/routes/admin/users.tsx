import { Link, redirect, createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { PaginationControls } from '~/components/PaginationControls'
import { UsersTopBarFilters } from '~/components/UsersTopBarFilters'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  SortableTableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '~/components/TableComponents'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Column,
} from '@tanstack/react-table'
import {
  useUpdateUserCapabilities,
  useAdminSetAdsDisabled,
  useAssignRolesToUser,
  useBulkAssignRolesToUsers,
  useBulkUpdateUserCapabilities,
} from '~/utils/mutations'
import { VALID_CAPABILITIES, type Capability } from '~/db/types'
import * as v from 'valibot'
import { listUsersQueryOptions } from '~/queries/users'
import {
  listRolesQueryOptions,
  getBulkUserRolesQueryOptions,
  getBulkEffectiveCapabilitiesQueryOptions,
} from '~/queries/roles'
import { getUserRoles } from '~/utils/roles.functions'
import { Save, SquarePen, X, Users } from 'lucide-react'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
  AdminEmptyState,
  UserAvatar,
} from '~/components/admin'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import { useToggleArray } from '~/hooks/useToggleArray'
import { handleAdminError } from '~/utils/adminErrors'
import { requireCapability } from '~/utils/auth.server'
import { Badge, Button } from '~/ui'

// User type for table - matches the shape returned by listUsers
type User = {
  _id: string
  userId: string
  email: string
  name: string | null
  displayUsername: string | null
  image: string | null
  capabilities: Capability[]
  adsDisabled: boolean | null
  interestedInHidingAds: boolean | null
  createdAt: number
  updatedAt: number
}

type _UsersSearch = {
  email?: string
  name?: string
  cap?: string | string[]
  noCapabilities?: boolean
  ads?: 'all' | 'true' | 'false'
  waitlist?: 'all' | 'true' | 'false'
  page?: number
  pageSize?: number
  useEffectiveCapabilities?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
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
        <Badge key={role._id} variant="purple">
          {role.name}
        </Badge>
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
        <Badge key={capability} variant="success">
          {capability}
        </Badge>
      ))}
      {(!effectiveCapabilities || effectiveCapabilities.length === 0) && (
        <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
      )}
    </div>
  )
}

const searchSchema = v.object({
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  cap: v.optional(v.union([v.string(), v.array(v.string())])),
  noCapabilities: v.optional(v.boolean()),
  ads: v.optional(v.picklist(['all', 'true', 'false'])),
  waitlist: v.optional(v.picklist(['all', 'true', 'false'])),
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  useEffectiveCapabilities: v.optional(v.boolean(), true),
  sortBy: v.optional(v.string()),
  sortDir: v.optional(v.picklist(['asc', 'desc'])),
})

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    try {
      const user = await requireCapability({ data: { capability: 'admin' } })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: UsersPage,
  validateSearch: searchSchema,
})

function UsersPage() {
  const guard = useAdminGuard()
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingCapabilities, toggleCapability, setEditingCapabilities] =
    useToggleArray<Capability>([])
  const [editingRoleIds, toggleRole, setEditingRoleIds] =
    useToggleArray<string>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [bulkActionRoleId, setBulkActionRoleId] = useState<string | null>(null)
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const emailFilter = search.email ?? ''
  const nameFilter = search.name ?? ''
  const capabilityFilters = useMemo(
    () =>
      Array.isArray(search.cap) ? search.cap : search.cap ? [search.cap] : [],
    [search.cap],
  )
  const noCapabilitiesFilter = search.noCapabilities ?? false
  const adsDisabledFilter = search.ads ?? 'all'
  const waitlistFilter = search.waitlist ?? 'all'
  const useEffectiveCapabilities = search.useEffectiveCapabilities ?? true
  const sortBy = search.sortBy
  const sortDir = search.sortDir

  const handleClearFilters = () => {
    navigate({
      resetScroll: false,
      search: {
        page: 0,
        pageSize: search.pageSize,
      },
    })
  }

  const handleFiltersChange = useCallback(
    (newFilters: {
      email?: string
      name?: string
      capabilities?: string[]
      noCapabilities?: boolean
      adsDisabled?: 'all' | 'true' | 'false'
      waitlist?: 'all' | 'true' | 'false'
      useEffectiveCapabilities?: boolean
    }) => {
      navigate({
        resetScroll: false,
        search: (prev) => ({
          ...prev,
          email: 'email' in newFilters ? newFilters.email : prev.email,
          name: 'name' in newFilters ? newFilters.name : prev.name,
          cap:
            'capabilities' in newFilters ? newFilters.capabilities : prev.cap,
          noCapabilities:
            'noCapabilities' in newFilters
              ? newFilters.noCapabilities
              : prev.noCapabilities,
          ads: 'adsDisabled' in newFilters ? newFilters.adsDisabled : prev.ads,
          waitlist:
            'waitlist' in newFilters ? newFilters.waitlist : prev.waitlist,
          useEffectiveCapabilities:
            'useEffectiveCapabilities' in newFilters
              ? newFilters.useEffectiveCapabilities!
              : prev.useEffectiveCapabilities,
          page: 0,
        }),
      })
    },
    [navigate],
  )

  const currentPageIndex = search.page ?? 0
  const pageSize = search.pageSize ?? 10

  const usersQuery = useQuery({
    ...listUsersQueryOptions({
      pagination: {
        limit: pageSize,
        page: currentPageIndex,
      },
      emailFilter: emailFilter || undefined,
      nameFilter: nameFilter || undefined,
      // @ts-expect-error not sure how to type this
      capabilityFilter:
        capabilityFilters.length > 0 ? capabilityFilters : undefined,
      noCapabilitiesFilter: noCapabilitiesFilter || undefined,
      adsDisabledFilter:
        adsDisabledFilter === 'all' ? undefined : adsDisabledFilter === 'true',
      interestedInHidingAdsFilter:
        waitlistFilter === 'all' ? undefined : waitlistFilter === 'true',
      useEffectiveCapabilities,
      sortBy,
      sortDir,
    }),
    placeholderData: keepPreviousData,
  })
  // counts now come from listUsers response

  const updateUserCapabilities = useUpdateUserCapabilities()
  const adminSetAdsDisabled = useAdminSetAdsDisabled()
  const assignRolesToUser = useAssignRolesToUser()
  const bulkAssignRolesToUsers = useBulkAssignRolesToUsers()
  const bulkUpdateUserCapabilities = useBulkUpdateUserCapabilities()
  const allRolesQuery = useQuery({
    ...listRolesQueryOptions({}),
    placeholderData: keepPreviousData,
  })
  const allRoles = useMemo(() => allRolesQuery.data || [], [allRolesQuery.data])

  // Bulk fetch user roles and effective capabilities to avoid N+1 queries
  const userIds = useMemo(
    () => (usersQuery?.data?.page || []).map((u: User) => u._id),
    [usersQuery?.data?.page],
  )
  const bulkUserRolesQuery = useQuery({
    ...getBulkUserRolesQueryOptions(userIds),
    placeholderData: keepPreviousData,
  })
  const bulkUserRoles = bulkUserRolesQuery.data
  const bulkEffectiveCapabilitiesQuery = useQuery({
    ...getBulkEffectiveCapabilitiesQueryOptions(userIds),
    placeholderData: keepPreviousData,
  })
  const bulkEffectiveCapabilities = bulkEffectiveCapabilitiesQuery.data

  const availableCapabilities = VALID_CAPABILITIES

  const handleEditUser = useCallback((user: User) => {
    setEditingUserId(user._id)
    setEditingCapabilities((user.capabilities || []) as Capability[])
    setEditingRoleIds([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable
  }, [])

  // Fetch user roles when editing starts
  // Always call hook (React requirement)
  // Pass userId only if it's valid, otherwise pass undefined (query handles it)
  const validEditingUserId =
    editingUserId &&
    typeof editingUserId === 'string' &&
    editingUserId.trim() !== ''
      ? editingUserId
      : undefined
  const editingUserRolesQuery = useQuery({
    queryKey: ['admin', 'userRoles', validEditingUserId],
    queryFn: async () => {
      if (!validEditingUserId) return []
      return getUserRoles({ data: { userId: validEditingUserId } })
    },
    enabled: !!validEditingUserId,
  })
  const editingUserRoles = editingUserRolesQuery.data

  useEffect(() => {
    if (editingUserRoles && editingUserId) {
      setEditingRoleIds(editingUserRoles.map((r) => r._id))
    } else if (!editingUserId) {
      setEditingRoleIds([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setter is stable
  }, [editingUserRoles, editingUserId])

  const handleSaveUser = useCallback(async () => {
    if (!editingUserId) return

    try {
      await Promise.all([
        updateUserCapabilities.mutateAsync({
          userId: editingUserId,
          capabilities: editingCapabilities,
        }),
        assignRolesToUser.mutateAsync({
          userId: editingUserId,
          roleIds: editingRoleIds,
        }),
      ])
      setEditingUserId(null)
      setEditingRoleIds([])
    } catch (error) {
      handleAdminError(error, 'Failed to update user')
    }
  }, [
    editingUserId,
    editingCapabilities,
    editingRoleIds,
    updateUserCapabilities,
    assignRolesToUser,
    setEditingRoleIds,
  ])

  const handleCancelEdit = useCallback(() => {
    setEditingUserId(null)
    setEditingCapabilities([])
    setEditingRoleIds([])
  }, [setEditingCapabilities, setEditingRoleIds])

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
      await bulkAssignRolesToUsers.mutateAsync({
        userIds: Array.from(selectedUserIds),
        roleIds: [bulkActionRoleId],
      })
      setSelectedUserIds(new Set())
      setBulkActionRoleId(null)
    } catch (error) {
      handleAdminError(error, 'Failed to assign role')
    }
  }, [selectedUserIds, bulkActionRoleId, bulkAssignRolesToUsers])

  const handleBulkUpdateCapabilities = useCallback(
    async (caps: Capability[]) => {
      if (selectedUserIds.size === 0) return

      if (
        !window.confirm(
          `Update capabilities for ${selectedUserIds.size} user(s)?`,
        )
      ) {
        return
      }

      try {
        await bulkUpdateUserCapabilities.mutateAsync({
          userIds: Array.from(selectedUserIds),
          capabilities: caps,
        })
        setSelectedUserIds(new Set())
      } catch (error) {
        handleAdminError(error, 'Failed to update capabilities')
      }
    },
    [selectedUserIds, bulkUpdateUserCapabilities],
  )

  const handleToggleAdsDisabled = useCallback(
    async (userId: string, nextValue: boolean) => {
      await adminSetAdsDisabled.mutateAsync({
        userId: userId,
        adsDisabled: nextValue,
      })
    },
    [adminSetAdsDisabled],
  )

  const handleSort = useCallback(
    (column: Column<User, unknown>) => {
      const columnId = column.id
      const sortDescFirst = column.columnDef.meta?.sortDescFirst ?? false

      if (sortBy !== columnId) {
        // New column: apply default direction
        navigate({
          resetScroll: false,
          search: (prev) => ({
            ...prev,
            sortBy: columnId,
            sortDir: sortDescFirst ? 'desc' : 'asc',
            page: 0,
          }),
        })
      } else if (sortDescFirst ? sortDir === 'desc' : sortDir === 'asc') {
        // First click was default, flip to opposite
        navigate({
          resetScroll: false,
          search: (prev) => ({
            ...prev,
            sortDir: sortDescFirst ? 'asc' : 'desc',
            page: 0,
          }),
        })
      } else {
        // Third click: clear sort
        navigate({
          resetScroll: false,
          search: (prev) => ({
            ...prev,
            sortBy: undefined,
            sortDir: undefined,
            page: 0,
          }),
        })
      }
    },
    [sortBy, sortDir, navigate],
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
        meta: { sortable: true },
        cell: ({ row }) => {
          const userData = row.original
          const displayName = userData.name || userData.displayUsername || ''
          return (
            <Link
              to="/admin/users/$userId"
              params={{ userId: userData._id }}
              className="flex items-center gap-3 hover:opacity-80"
              onClick={(e) => e.stopPropagation()}
            >
              <UserAvatar
                image={userData.image}
                name={userData.name}
                size="lg"
              />
              {displayName && (
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {displayName}
                </div>
              )}
            </Link>
          )
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        meta: { sortable: true },
        cell: ({ getValue }) => (
          <div className="text-sm text-gray-900 dark:text-white">
            {getValue()}
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
                <Badge key={capability} variant="info">
                  {capability}
                </Badge>
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
            <Badge variant={onWaitlist ? 'success' : 'default'}>
              {onWaitlist ? 'Yes' : 'No'}
            </Badge>
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
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleEditUser(user)}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <SquarePen className="w-4 h-4" />
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
      allRoles,
      selectedUserIds,
      toggleUserSelection,
      toggleAllSelection,
      usersQuery,
      bulkUserRoles,
      bulkEffectiveCapabilities,
    ],
  )

  // Pagination state
  const canGoPrevious = currentPageIndex > 0
  const canGoNext = !usersQuery?.data?.isDone

  // Create table instance
  const table = useReactTable({
    data: (usersQuery?.data?.page || []) as User[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  // Auth guard
  if (guard.status === 'loading') {
    return <AdminLoading />
  }
  if (guard.status === 'denied') {
    return <AdminAccessDenied />
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
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          icon={<Users />}
          title="Manage Users"
          isLoading={usersQuery.isFetching}
        />

        <UsersTopBarFilters
          filters={{
            email: emailFilter || undefined,
            name: nameFilter || undefined,
            capabilities:
              capabilityFilters.length > 0 ? capabilityFilters : undefined,
            noCapabilities: noCapabilitiesFilter || undefined,
            adsDisabled: adsDisabledFilter,
            waitlist: waitlistFilter,
            useEffectiveCapabilities,
          }}
          onFilterChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        <div className="flex-1 min-w-0">
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
                  <label
                    htmlFor="bulk-update-capabilities"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
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
                  <Button
                    onClick={handleBulkAssignRole}
                    disabled={!bulkActionRoleId}
                    size="sm"
                  >
                    Assign
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="bulk-update-capabilities"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Set Capabilities:
                  </label>
                  {availableCapabilities.map((capability) => (
                    <Button
                      key={capability}
                      onClick={() => handleBulkUpdateCapabilities([capability])}
                      color="green"
                      size="sm"
                    >
                      Add {capability}
                    </Button>
                  ))}
                  <Button
                    onClick={() => handleBulkUpdateCapabilities([])}
                    color="red"
                    size="sm"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Table Container */}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableHeaderRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <SortableTableHeaderCell
                      key={header.id}
                      align={
                        header.column.columnDef.meta?.align === 'right'
                          ? 'right'
                          : 'left'
                      }
                      sortable={header.column.columnDef.meta?.sortable}
                      sortDirection={
                        sortBy === header.column.id ? sortDir || false : false
                      }
                      onSort={() => handleSort(header.column)}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </SortableTableHeaderCell>
                  ))}
                </TableHeaderRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="whitespace-nowrap"
                      align={
                        cell.column.columnDef.meta?.align === 'right'
                          ? 'right'
                          : 'left'
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(!usersQuery.data || usersQuery.data?.page.length === 0) && (
            <AdminEmptyState
              icon={<Users className="w-12 h-12" />}
              title="No users found"
              description="There are currently no users in the system."
            />
          )}

          {/* Pagination Controls - Bottom (Sticky) */}
          {usersQuery?.data && usersQuery.data.page.length > 0 && (
            <PaginationControls
              currentPage={currentPageIndex}
              totalPages={Math.max(
                1,
                Math.ceil((usersQuery?.data?.counts?.filtered ?? 0) / pageSize),
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
              sticky
            />
          )}
        </div>
      </div>
    </div>
  )
}
