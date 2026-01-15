import { redirect, createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo, useCallback } from 'react'
import { PaginationControls } from '~/components/PaginationControls'
import { LoginsTopBarFilters } from '~/components/LoginsTopBarFilters'
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
import * as v from 'valibot'
import { listLoginHistory } from '~/utils/audit.functions'
import { LogIn } from 'lucide-react'
import { Badge } from '~/ui'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
  AdminEmptyState,
  UserAvatar,
  StatsCard,
} from '~/components/admin'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import { requireCapability } from '~/utils/auth.server'

type LoginHistoryEntry = {
  id: string
  userId: string
  provider: string
  ipAddress: string | null
  userAgent: string | null
  isNewUser: boolean
  createdAt: number
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

type LoginsSearch = {
  userId?: string
  provider?: 'github' | 'google'
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export const Route = createFileRoute('/admin/logins')({
  beforeLoad: async () => {
    try {
      const user = await requireCapability({ data: { capability: 'admin' } })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: LoginsPage,
  validateSearch: (search) =>
    v.parse(
      v.object({
        userId: v.optional(v.string()),
        provider: v.optional(v.picklist(['github', 'google'])),
        page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
        pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
        sortBy: v.optional(v.string()),
        sortDir: v.optional(v.picklist(['asc', 'desc'])),
      }),
      search,
    ),
})

function LoginsPage() {
  const guard = useAdminGuard()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const userIdFilter = search.userId ?? ''
  const providerFilter = search.provider
  const sortBy = search.sortBy
  const sortDir = search.sortDir

  const currentPageIndex = search.page ?? 0
  const pageSize = search.pageSize ?? 25

  const loginsQuery = useQuery({
    queryKey: [
      'admin',
      'login-history',
      {
        page: currentPageIndex,
        pageSize,
        userId: userIdFilter,
        provider: providerFilter,
        sortBy,
        sortDir,
      },
    ],
    queryFn: () =>
      listLoginHistory({
        data: {
          pagination: {
            limit: pageSize,
            page: currentPageIndex,
          },
          userId: userIdFilter || undefined,
          provider: providerFilter,
          sortBy,
          sortDir,
        },
      }),
    placeholderData: keepPreviousData,
  })

  const handleClearFilters = () => {
    navigate({
      resetScroll: false,
      search: {
        page: 0,
        pageSize: search.pageSize,
      },
    })
  }

  const handleSort = useCallback(
    (column: Column<LoginHistoryEntry, unknown>) => {
      const columnId = column.id
      const sortDescFirst = column.columnDef.meta?.sortDescFirst ?? false

      if (sortBy !== columnId) {
        // New column: apply default direction
        navigate({
          resetScroll: false,
          search: (prev: LoginsSearch) => ({
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
          search: (prev: LoginsSearch) => ({
            ...prev,
            sortDir: sortDescFirst ? 'asc' : 'desc',
            page: 0,
          }),
        })
      } else {
        // Third click: clear sort
        navigate({
          resetScroll: false,
          search: (prev: LoginsSearch) => ({
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

  const columns = useMemo<ColumnDef<LoginHistoryEntry, unknown>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => {
          const entry = row.original
          const displayName = entry.userName || entry.userEmail || 'Unknown'
          return (
            <div className="flex items-center gap-3">
              <UserAvatar image={entry.userImage} name={entry.userName} />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {displayName}
                </div>
                {entry.userEmail && entry.userName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.userEmail}
                  </div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'provider',
        header: 'Provider',
        cell: ({ getValue }) => {
          const provider = getValue() as string
          return (
            <Badge variant={provider === 'github' ? 'default' : 'info'}>
              {provider}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'isNewUser',
        header: 'Type',
        cell: ({ getValue }) => {
          const isNew = getValue() as boolean
          return (
            <Badge variant={isNew ? 'success' : 'default'}>
              {isNew ? 'Signup' : 'Login'}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'ipAddress',
        header: 'IP Address',
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
            {(getValue() as string | null) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Time',
        meta: { sortable: true, sortDescFirst: true },
        cell: ({ getValue }) => {
          const timestamp = getValue() as number
          const date = new Date(timestamp)
          return (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>{date.toLocaleDateString()}</div>
              <div className="text-xs">{date.toLocaleTimeString()}</div>
            </div>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: (loginsQuery?.data?.page || []) as LoginHistoryEntry[],
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

  const canGoPrevious = currentPageIndex > 0
  const canGoNext = !loginsQuery?.data?.isDone

  return (
    <div className="w-full p-4">
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          icon={<LogIn />}
          title="Login History"
          isLoading={loginsQuery.isFetching}
        />

        {/* Top Bar Filters */}
        <LoginsTopBarFilters
          filters={{
            userId: userIdFilter || undefined,
            provider: providerFilter,
          }}
          onFilterChange={(newFilters) => {
            navigate({
              resetScroll: false,
              search: (prev: LoginsSearch) => ({
                ...prev,
                ...newFilters,
                page: 0,
              }),
            })
          }}
          onClearFilters={handleClearFilters}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Stats Cards */}
          {loginsQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatsCard
                label="Total Records"
                value={loginsQuery.data.counts.total}
              />
            </div>
          )}

          {/* Table */}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableHeaderRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <SortableTableHeaderCell
                      key={header.id}
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
                    <TableCell key={cell.id} className="whitespace-nowrap">
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

          {(!loginsQuery.data || loginsQuery.data?.page.length === 0) && (
            <AdminEmptyState
              icon={<LogIn className="w-12 h-12" />}
              title="No login records found"
              description="Login history will appear here once users start logging in."
            />
          )}

          {/* Pagination */}
          {loginsQuery?.data && loginsQuery.data.page.length > 0 && (
            <PaginationControls
              currentPage={currentPageIndex}
              totalPages={loginsQuery.data.counts.pages}
              totalItems={loginsQuery.data.counts.total}
              pageSize={pageSize}
              onPageChange={(page) => {
                navigate({
                  resetScroll: false,
                  search: (prev: LoginsSearch) => ({ ...prev, page }),
                })
              }}
              onPageSizeChange={(newPageSize) => {
                navigate({
                  resetScroll: false,
                  search: (prev: LoginsSearch) => ({
                    ...prev,
                    pageSize: newPageSize,
                    page: 0,
                  }),
                })
              }}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              itemLabel="logins"
              sticky
            />
          )}
        </div>
      </div>
    </div>
  )
}
