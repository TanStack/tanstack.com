import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo } from 'react'
import { PaginationControls } from '~/components/PaginationControls'
import { Spinner } from '~/components/Spinner'
import { FilterBar, FilterSearch } from '~/components/FilterComponents'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '~/components/TableComponents'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import * as v from 'valibot'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { listLoginHistory } from '~/utils/audit.functions'
import { Lock, LogIn, User } from 'lucide-react'
import { Card } from '~/components/Card'

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
}

export const Route = createFileRoute('/admin/logins')({
  component: LoginsPage,
  validateSearch: (search) =>
    v.parse(
      v.object({
        userId: v.optional(v.string()),
        provider: v.optional(v.picklist(['github', 'google'])),
        page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
        pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
      }),
      search,
    ),
})

function LoginsPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const userIdFilter = search.userId ?? ''
  const providerFilter = search.provider

  const currentPageIndex = search.page ?? 0
  const pageSize = search.pageSize ?? 25

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data

  const loginsQuery = useQuery({
    queryKey: [
      'admin',
      'login-history',
      {
        page: currentPageIndex,
        pageSize,
        userId: userIdFilter,
        provider: providerFilter,
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
        },
      }),
    placeholderData: keepPreviousData,
  })

  const hasActiveFilters = userIdFilter !== '' || !!providerFilter

  const handleClearFilters = () => {
    navigate({
      resetScroll: false,
      search: {
        page: 0,
        pageSize: search.pageSize,
      },
    })
  }

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
              <div className="flex-shrink-0 h-8 w-8">
                {entry.userImage ? (
                  <img
                    className="h-8 w-8 rounded-full"
                    src={entry.userImage}
                    alt=""
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
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
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                provider === 'github'
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}
            >
              {provider}
            </span>
          )
        },
      },
      {
        accessorKey: 'isNewUser',
        header: 'Type',
        cell: ({ getValue }) => {
          const isNew = getValue() as boolean
          return (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isNew
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {isNew ? 'Signup' : 'Login'}
            </span>
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

  // Check auth
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

  const canGoPrevious = currentPageIndex > 0
  const canGoNext = !loginsQuery?.data?.isDone

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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                User ID
              </label>
              <FilterSearch
                value={userIdFilter}
                onChange={(value) => {
                  navigate({
                    resetScroll: false,
                    search: (prev: LoginsSearch) => ({
                      ...prev,
                      userId: value || undefined,
                      page: 0,
                    }),
                  })
                }}
                placeholder="Filter by user ID"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Provider
              </label>
              <select
                value={providerFilter || ''}
                onChange={(e) => {
                  const value = e.target.value as 'github' | 'google' | ''
                  navigate({
                    resetScroll: false,
                    search: (prev: LoginsSearch) => ({
                      ...prev,
                      provider: value || undefined,
                      page: 0,
                    }),
                  })
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All providers</option>
                <option value="github">GitHub</option>
                <option value="google">Google</option>
              </select>
            </div>
          </FilterBar>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <LogIn className="text-2xl text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Login History
            </h1>
            {loginsQuery.isFetching && (
              <Spinner className="text-gray-500 dark:text-gray-400" />
            )}
          </div>

          {/* Stats Cards */}
          {loginsQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Records
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loginsQuery.data.counts.total.toLocaleString()}
                </div>
              </Card>
            </div>
          )}

          {/* Table */}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableHeaderRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHeaderCell key={header.id}>
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
            <div className="text-center py-12">
              <LogIn className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No login records found
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Login history will appear here once users start logging in.
              </p>
            </div>
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
