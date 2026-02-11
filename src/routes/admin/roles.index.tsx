import { Link, redirect, createFileRoute } from '@tanstack/react-router'
import { RolesTopBarFilters } from '~/components/RolesTopBarFilters'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '~/components/TableComponents'
import * as v from 'valibot'
import { useState, useMemo, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useCreateRole, useUpdateRole, useDeleteRole } from '~/utils/mutations'
import { listRoles, sendTestModeratorEmail } from '~/utils/roles.functions'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type Row,
} from '@tanstack/react-table'
import {
  SquarePen,
  Plus,
  Save,
  X,
  Trash,
  Users,
  Mail,
  Shield,
} from 'lucide-react'
import { VALID_CAPABILITIES, type Capability } from '~/db/types'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
  AdminEmptyState,
} from '~/components/admin'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import { requireCapability } from '~/utils/auth.server'
import { useToggleArray } from '~/hooks/useToggleArray'
import { useDeleteWithConfirmation } from '~/hooks/useDeleteWithConfirmation'
import { Badge, Button, FormInput } from '~/ui'

// Role type for table - matches the shape returned by listRoles
interface Role {
  _id: string
  name: string
  description: string | null
  capabilities: Capability[]
  createdAt: number
  updatedAt: number
}

export const Route = createFileRoute('/admin/roles/')({
  beforeLoad: async () => {
    try {
      const user = await requireCapability({ data: { capability: 'admin' } })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: RolesPage,
  validateSearch: (search) =>
    v.parse(
      v.object({
        name: v.optional(v.string()),
        cap: v.optional(v.union([v.string(), v.array(v.string())])),
      }),
      search,
    ),
})

function RolesPage() {
  const guard = useAdminGuard()
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingDescription, setEditingDescription] = useState('')
  const [editingCapabilities, toggleCapability, setEditingCapabilities] =
    useToggleArray<Capability>([])
  const [isCreating, setIsCreating] = useState(false)
  const [testEmailCapability, setTestEmailCapability] =
    useState<Capability>('moderate-showcases')
  const [testEmailStatus, setTestEmailStatus] = useState<{
    loading: boolean
    result?: { success: boolean; emails: string[]; error?: string }
  }>({ loading: false })

  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const nameFilter = search.name ?? ''
  const capabilityFilters = useMemo(
    () =>
      Array.isArray(search.cap) ? search.cap : search.cap ? [search.cap] : [],
    [search.cap],
  )

  const handleClearFilters = () => {
    navigate({
      resetScroll: false,
      search: {},
    })
  }

  const handleFiltersChange = useCallback(
    (newFilters: { name?: string; capabilities?: string[] }) => {
      navigate({
        resetScroll: false,
        search: (prev: { name?: string; cap?: string | string[] }) => ({
          ...prev,
          name: 'name' in newFilters ? newFilters.name : prev.name,
          cap:
            'capabilities' in newFilters ? newFilters.capabilities : prev.cap,
        }),
      })
    },
    [navigate],
  )

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles', nameFilter, capabilityFilters],
    queryFn: async () => {
      return listRoles({
        data: {
          nameFilter: nameFilter || undefined,
          capabilityFilter:
            capabilityFilters.length > 0
              ? (capabilityFilters as Capability[])
              : undefined,
        },
      })
    },
    placeholderData: keepPreviousData,
  })
  const roles = rolesQuery?.data

  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const availableCapabilities = VALID_CAPABILITIES

  const handleCreateRole = useCallback(() => {
    setIsCreating(true)
    setEditingName('')
    setEditingDescription('')
    setEditingCapabilities([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEditRole = useCallback((role: Role) => {
    setEditingRoleId(role._id)
    setEditingName(role.name)
    setEditingDescription(role.description || '')
    setEditingCapabilities((role.capabilities || []) as Capability[])
    setIsCreating(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [setEditingCapabilities])

  const { handleDelete: handleDeleteRole } = useDeleteWithConfirmation({
    getItemName: (role: Role) => role.name,
    deleteFn: async (role) => {
      await deleteRole.mutateAsync({ roleId: role._id })
    },
    itemLabel: 'role',
  })

  const handleSendTestEmail = useCallback(async () => {
    setTestEmailStatus({ loading: true })
    try {
      const result = await sendTestModeratorEmail({
        data: { capability: testEmailCapability },
      })
      setTestEmailStatus({ loading: false, result })
    } catch (error) {
      setTestEmailStatus({
        loading: false,
        result: {
          success: false,
          emails: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }, [testEmailCapability])

  // Define columns using the column helper
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }: { row: Row<Role> }) => {
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
        cell: ({ row }: { row: Row<Role> }) => {
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
        cell: ({ row }: { row: Row<Role> }) => {
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
              {(role.capabilities || []).map((capability) => (
                <Badge key={capability} variant="info">
                  {capability}
                </Badge>
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
        cell: ({ row }: { row: Row<Role> }) => {
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
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
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
                <Users className="w-4 h-4" />
              </Link>
              <button
                onClick={() => handleEditRole(role)}
                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <SquarePen className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteRole(role)}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash className="w-4 h-4" />
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

  // Auth guard
  if (guard.status === 'loading') {
    return <AdminLoading />
  }
  if (guard.status === 'denied') {
    return <AdminAccessDenied />
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
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          icon={<Shield />}
          title="Manage Roles"
          isLoading={rolesQuery.isFetching}
          actions={
            !isCreating && (
              <Button size="xs" onClick={handleCreateRole}>
                <Plus className="w-4 h-4" />
                Create Role
              </Button>
            )
          }
        />

        <RolesTopBarFilters
          filters={{
            name: nameFilter || undefined,
            capabilities:
              capabilityFilters.length > 0 ? capabilityFilters : undefined,
          }}
          onFilterChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          extraContent={
            <div className="flex items-center gap-2">
              <select
                value={testEmailCapability}
                onChange={(e) =>
                  setTestEmailCapability(e.target.value as Capability)
                }
                className="px-2 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
              >
                {VALID_CAPABILITIES.filter(
                  (cap) => cap === 'admin' || cap.startsWith('moderate-'),
                ).map((cap) => (
                  <option key={cap} value={cap}>
                    {cap}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleSendTestEmail}
                disabled={testEmailStatus.loading}
                color="gray"
                size="sm"
              >
                <Mail className="w-4 h-4" />
                {testEmailStatus.loading ? 'Sending...' : 'Test Email'}
              </Button>
            </div>
          }
        />

        <div className="flex-1 min-w-0">
          {isCreating && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Create New Role
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="role-name"
                    className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2"
                  >
                    Name
                  </label>
                  <FormInput
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="rounded-md"
                    placeholder="Role name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="role-description"
                    className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2"
                  >
                    Description
                  </label>
                  <FormInput
                    type="text"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    className="rounded-md"
                    placeholder="Role description"
                  />
                </div>
                <div>
                  <label
                    htmlFor="role-capabilities"
                    className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2"
                  >
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
                  <Button onClick={handleSaveRole} color="green">
                    <Save className="w-4 h-4" />
                    Save
                  </Button>
                  <Button onClick={handleCancelEdit} color="gray">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
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
                        (
                          header.column.columnDef.meta as
                            | { align?: 'left' | 'right' }
                            | undefined
                        )?.align === 'right'
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
                        (
                          cell.column.columnDef.meta as
                            | { align?: 'left' | 'right' }
                            | undefined
                        )?.align === 'right'
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
            <AdminEmptyState
              icon={<Shield className="w-12 h-12" />}
              title="No roles found"
              description="Create your first role to get started."
            />
          )}
        </div>
      </div>
    </div>
  )
}
