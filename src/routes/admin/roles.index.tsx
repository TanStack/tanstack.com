import { createFileRoute, Link } from '@tanstack/react-router'
import {
  FilterBar,
  FilterSearch,
  FilterCheckbox,
  FilterSection,
} from '~/components/FilterComponents'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '~/components/TableComponents'
import { z } from 'zod'
import { useState, useMemo, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useCreateRole, useUpdateRole, useDeleteRole } from '~/utils/mutations'
import { listRoles } from '~/utils/roles.functions'
import {
  FaEdit,
  FaSave,
  FaTimes,
  FaLock,
  FaPlus,
  FaTrash,
  FaUsers,
  FaSpinner,
} from 'react-icons/fa'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'

// Role type for table
type Role = {
  _id: string
  name: string
  description?: string
  capabilities: string[]
  createdAt: number
  updatedAt: number
}

export const Route = createFileRoute('/admin/roles/')({
  component: RolesPage,
  validateSearch: z.object({
    name: z.string().optional(),
    cap: z.union([z.string(), z.array(z.string())]).optional(),
  }),
})

function RolesPage() {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDescription, setEditingDescription] = useState('')
  const [editingCapabilities, setEditingCapabilities] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const nameFilter = search.name ?? ''
  const capabilityFilters = useMemo(
    () =>
      Array.isArray(search.cap) ? search.cap : search.cap ? [search.cap] : [],
    [search.cap],
  )

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    capabilities: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev: Record<string, boolean>) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const hasActiveFilters = nameFilter !== '' || capabilityFilters.length > 0

  const handleClearFilters = () => {
    navigate({
      resetScroll: false,
      search: {},
    })
  }

  const renderFilterContent = () => (
    <>
      {/* Name Filter */}
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Name / Description
        </label>
        <FilterSearch
          value={nameFilter}
          onChange={(value) => {
            navigate({
              resetScroll: false,
              search: (prev: any) => ({
                ...prev,
                name: value || undefined,
              }),
            })
          }}
          placeholder="Filter by name or description"
        />
      </div>

      {/* Capabilities Filter */}
      <FilterSection
        title="Capabilities"
        sectionKey="capabilities"
        onSelectAll={() => {
          navigate({
            resetScroll: false,
            search: (prev: any) => ({
              ...prev,
              cap: availableCapabilities,
            }),
          })
        }}
        onSelectNone={() => {
          navigate({
            resetScroll: false,
            search: (prev: any) => ({
              ...prev,
              cap: undefined,
            }),
          })
        }}
        isAllSelected={
          capabilityFilters.length === availableCapabilities.length
        }
        isSomeSelected={
          capabilityFilters.length > 0 &&
          capabilityFilters.length < availableCapabilities.length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {availableCapabilities.map((cap) => (
          <FilterCheckbox
            key={cap}
            label={cap}
            checked={capabilityFilters.includes(cap)}
            onChange={() => handleCapabilityFilterToggle(cap)}
          />
        ))}
      </FilterSection>
    </>
  )

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const capabilities = useCapabilities()
  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles', nameFilter, capabilityFilters],
    queryFn: async () => {
      return listRoles({
        data: {
          nameFilter: nameFilter || undefined,
          capabilityFilter:
            capabilityFilters.length > 0 ? capabilityFilters : undefined,
        },
      })
    },
    placeholderData: keepPreviousData,
  })
  const roles = rolesQuery?.data

  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const availableCapabilities = useMemo(
    () => ['admin', 'disableAds', 'builder', 'feed'],
    [],
  )

  const handleCreateRole = useCallback(() => {
    setIsCreating(true)
    setEditingName('')
    setEditingDescription('')
    setEditingCapabilities([])
  }, [])

  const handleEditRole = useCallback((role: Role) => {
    setEditingRoleId(role._id)
    setEditingName(role.name)
    setEditingDescription(role.description || '')
    setEditingCapabilities(role.capabilities || [])
    setIsCreating(false)
  }, [])

  const handleSaveRole = useCallback(async () => {
    try {
      if (isCreating) {
        await createRole.mutateAsync({
          name: editingName,
          description: editingDescription || undefined,
          capabilities: editingCapabilities,
        })
        setIsCreating(false)
      } else if (editingRoleId) {
        await updateRole.mutateAsync({
          roleId: editingRoleId,
          name: editingName,
          description: editingDescription || undefined,
          capabilities: editingCapabilities,
        })
        setEditingRoleId(null)
      }
      setEditingName('')
      setEditingDescription('')
      setEditingCapabilities([])
    } catch (error) {
      console.error('Failed to save role:', error)
      alert(error instanceof Error ? error.message : 'Failed to save role')
    }
  }, [
    isCreating,
    editingRoleId,
    editingName,
    editingDescription,
    editingCapabilities,
    createRole,
    updateRole,
  ])

  const handleCancelEdit = useCallback(() => {
    setEditingRoleId(null)
    setIsCreating(false)
    setEditingName('')
    setEditingDescription('')
    setEditingCapabilities([])
  }, [])

  const handleDeleteRole = useCallback(
    async (roleId: string) => {
      if (!window.confirm('Are you sure you want to delete this role?')) {
        return
      }
      try {
        await deleteRole.mutateAsync({ roleId: roleId })
      } catch (error) {
        console.error('Failed to delete role:', error)
        alert(error instanceof Error ? error.message : 'Failed to delete role')
      }
    },
    [deleteRole],
  )

  const toggleCapability = useCallback(
    (capability: string) => {
      if (editingCapabilities.includes(capability)) {
        setEditingCapabilities(
          editingCapabilities.filter((c: string) => c !== capability),
        )
      } else {
        setEditingCapabilities([...editingCapabilities, capability])
      }
    },
    [editingCapabilities],
  )

  const handleCapabilityFilterToggle = useCallback(
    (capability: string) => {
      const newFilters = capabilityFilters.includes(capability)
        ? capabilityFilters.filter((c: string) => c !== capability)
        : [...capabilityFilters, capability]
      navigate({
        resetScroll: false,
        search: (prev: any) => ({
          ...prev,
          cap: newFilters.length > 0 ? newFilters : undefined,
        }),
      })
    },
    [capabilityFilters, navigate],
  )

  // Define columns using the column helper
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }: { row: any }) => {
          const role = row.original
          return editingRoleId === role._id ||
            (isCreating && role._id === 'new') ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="px-2 py-1 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              placeholder="Role name"
            />
          ) : (
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {role.name}
            </div>
          )
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }: { row: any }) => {
          const role = row.original
          return editingRoleId === role._id ||
            (isCreating && role._id === 'new') ? (
            <input
              type="text"
              value={editingDescription}
              onChange={(e) => setEditingDescription(e.target.value)}
              className="px-2 py-1 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white w-full"
              placeholder="Role description"
            />
          ) : (
            <div className="text-sm text-gray-900 dark:text-white">
              {role.description || (
                <span className="text-gray-400">No description</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'capabilities',
        header: 'Capabilities',
        cell: ({ row }: { row: any }) => {
          const role = row.original
          return editingRoleId === role._id ||
            (isCreating && role._id === 'new') ? (
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
              {(role.capabilities || []).map((capability: string) => (
                <span
                  key={capability}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {capability}
                </span>
              ))}
              {(!role.capabilities || role.capabilities.length === 0) && (
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
        cell: ({ row }: { row: any }) => {
          const role = row.original
          if (
            editingRoleId === role._id ||
            (isCreating && role._id === 'new')
          ) {
            return (
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveRole}
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
            )
          }
          return (
            <div className="flex space-x-2">
              <Link
                to="/admin/roles/$roleId"
                params={{ roleId: role._id }}
                className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                title="View users with this role"
              >
                <FaUsers className="w-4 h-4" />
              </Link>
              <button
                onClick={() => handleEditRole(role)}
                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <FaEdit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteRole(role._id)}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                <FaTrash className="w-4 h-4" />
              </button>
            </div>
          )
        },
      },
    ],
    [
      editingRoleId,
      isCreating,
      editingName,
      editingDescription,
      editingCapabilities,
      availableCapabilities,
      handleSaveRole,
      handleCancelEdit,
      handleEditRole,
      handleDeleteRole,
      toggleCapability,
    ],
  )

  // Create table instance
  const table = useReactTable({
    data: roles || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
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
        </div>
      </div>
    )
  }

  if (!roles) {
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
          <FilterBar
            title="Filters"
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          >
            {renderFilterContent()}
          </FilterBar>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Manage Roles
              </h1>
              {rolesQuery.isFetching && (
                <FaSpinner className="animate-spin text-gray-500 dark:text-gray-400" />
              )}
            </div>
            {!isCreating && (
              <button
                onClick={handleCreateRole}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="w-4 h-4" />
                Create Role
              </button>
            )}
          </div>

          {isCreating && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Create New Role
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    placeholder="Role name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    placeholder="Role description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Capabilities
                  </label>
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
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveRole}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FaSave className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <FaTimes className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableHeaderRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHeaderCell
                      key={header.id}
                      align={
                        (header.column.columnDef.meta as any)?.align === 'right'
                          ? 'right'
                          : 'left'
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHeaderCell>
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
                        (cell.column.columnDef.meta as any)?.align === 'right'
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

          {(!roles || roles.length === 0) && (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No roles found
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Create your first role to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
