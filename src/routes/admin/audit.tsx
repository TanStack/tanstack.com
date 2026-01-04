import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
import { z } from 'zod'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { listAuditLogs } from '~/utils/audit.functions'
import { Lock, Shield, User, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '~/components/Card'

type AuditLogEntry = {
  id: string
  actorId: string
  action: string
  targetType: string
  targetId: string
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: number
  actorName: string | null
  actorEmail: string | null
  actorImage: string | null
  targetUserName: string | null
  targetUserEmail: string | null
  targetUserImage: string | null
}

const ACTION_LABELS: Record<string, string> = {
  'user.capabilities.update': 'Updated Capabilities',
  'user.adsDisabled.update': 'Updated Ads Status',
  'user.sessions.revoke': 'Revoked Sessions',
  'role.create': 'Created Role',
  'role.update': 'Updated Role',
  'role.delete': 'Deleted Role',
  'role.assignment.create': 'Assigned Role',
  'role.assignment.delete': 'Removed Role',
  'banner.create': 'Created Banner',
  'banner.update': 'Updated Banner',
  'banner.delete': 'Deleted Banner',
  'feed.entry.create': 'Created Feed Entry',
  'feed.entry.update': 'Updated Feed Entry',
  'feed.entry.delete': 'Deleted Feed Entry',
  'feedback.moderate': 'Moderated Feedback',
}

const ACTION_COLORS: Record<string, string> = {
  'user.capabilities.update':
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'user.adsDisabled.update':
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'user.sessions.revoke':
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'role.create':
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'role.update':
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'role.delete': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'role.assignment.create':
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'role.assignment.delete':
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export const Route = createFileRoute('/admin/audit')({
  component: AuditPage,
  validateSearch: z.object({
    actorId: z.string().optional(),
    action: z.string().optional(),
    targetType: z.string().optional(),
    page: z.number().int().nonnegative().optional(),
    pageSize: z.number().int().positive().optional(),
  }),
})

function DetailsCell({ details }: { details: string | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!details) {
    return <span className="text-gray-400">-</span>
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(details)
  } catch {
    return (
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {details}
      </span>
    )
  }

  const formatted = JSON.stringify(parsed, null, 2)
  const isLong = formatted.length > 100

  return (
    <div className="max-w-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        {expanded ? 'Hide' : 'Show'} Details
      </button>
      {expanded && (
        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
          {formatted}
        </pre>
      )}
    </div>
  )
}

function AuditPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const actorIdFilter = search.actorId ?? ''
  const actionFilter = search.action ?? ''
  const targetTypeFilter = search.targetType ?? ''

  const currentPageIndex = search.page ?? 0
  const pageSize = search.pageSize ?? 25

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data

  const auditQuery = useQuery({
    queryKey: [
      'admin',
      'audit-logs',
      {
        page: currentPageIndex,
        pageSize,
        actorId: actorIdFilter,
        action: actionFilter,
        targetType: targetTypeFilter,
      },
    ],
    queryFn: () =>
      listAuditLogs({
        data: {
          pagination: {
            limit: pageSize,
            page: currentPageIndex,
          },
          actorId: actorIdFilter || undefined,
          action: actionFilter || undefined,
          targetType: targetTypeFilter || undefined,
        },
      }),
    placeholderData: keepPreviousData,
  })

  const hasActiveFilters =
    actorIdFilter !== '' || actionFilter !== '' || targetTypeFilter !== ''

  const handleClearFilters = () => {
    navigate({
      resetScroll: false,
      search: {
        page: 0,
        pageSize: search.pageSize,
      },
    })
  }

  const columns = useMemo<ColumnDef<AuditLogEntry, unknown>[]>(
    () => [
      {
        id: 'actor',
        header: 'Actor',
        cell: ({ row }) => {
          const entry = row.original
          const displayName = entry.actorName || entry.actorEmail || 'Unknown'
          return (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-8 w-8">
                {entry.actorImage ? (
                  <img
                    className="h-8 w-8 rounded-full"
                    src={entry.actorImage}
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
                {entry.actorEmail && entry.actorName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.actorEmail}
                  </div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ getValue }) => {
          const action = getValue() as string
          const label = ACTION_LABELS[action] || action
          const colorClass =
            ACTION_COLORS[action] ||
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          return (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
            >
              {label}
            </span>
          )
        },
      },
      {
        id: 'target',
        header: 'Target',
        cell: ({ row }) => {
          const entry = row.original

          // Determine if we can link to a detail page
          const getTargetLink = () => {
            switch (entry.targetType) {
              case 'user':
                return {
                  to: '/admin/users/$userId',
                  params: { userId: entry.targetId },
                }
              case 'role':
                return {
                  to: '/admin/roles/$roleId',
                  params: { roleId: entry.targetId },
                }
              case 'banner':
                return {
                  to: '/admin/banners/$id',
                  params: { id: entry.targetId },
                }
              case 'feed_entry':
                return { to: '/admin/feed/$id', params: { id: entry.targetId } }
              case 'showcase':
                return {
                  to: '/admin/showcases_/$id',
                  params: { id: entry.targetId },
                }
              case 'feedback':
                return {
                  to: '/admin/feedback_/$id',
                  params: { id: entry.targetId },
                }
              default:
                return null
            }
          }

          const linkProps = getTargetLink()

          // If target is a user and we have their info, show it
          if (
            entry.targetType === 'user' &&
            (entry.targetUserName || entry.targetUserEmail)
          ) {
            const displayName =
              entry.targetUserName || entry.targetUserEmail || 'Unknown'
            const content = (
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 h-6 w-6">
                  {entry.targetUserImage ? (
                    <img
                      className="h-6 w-6 rounded-full"
                      src={entry.targetUserImage}
                      alt=""
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {displayName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {entry.targetId.substring(0, 8)}...
                  </div>
                </div>
              </div>
            )
            return linkProps ? (
              <Link {...linkProps} className="hover:opacity-80">
                {content}
              </Link>
            ) : (
              content
            )
          }

          // For non-user targets, show type and ID
          const content = (
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {entry.targetType.replace('_', ' ')}
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {entry.targetId.substring(0, 8)}...
              </div>
            </div>
          )

          return linkProps ? (
            <Link {...linkProps} className="hover:opacity-80 block">
              {content}
            </Link>
          ) : (
            content
          )
        },
      },
      {
        id: 'details',
        header: 'Details',
        cell: ({ row }) => <DetailsCell details={row.original.details} />,
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
    data: (auditQuery?.data?.page || []) as AuditLogEntry[],
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
  const canGoNext = !auditQuery?.data?.isDone

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
                Actor ID
              </label>
              <FilterSearch
                value={actorIdFilter}
                onChange={(value) => {
                  navigate({
                    resetScroll: false,
                    search: {
                      ...search,
                      actorId: value || undefined,
                      page: 0,
                    },
                  })
                }}
                placeholder="Filter by actor ID"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  navigate({
                    resetScroll: false,
                    search: {
                      ...search,
                      action: e.target.value || undefined,
                      page: 0,
                    },
                  })
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All actions</option>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Target Type
              </label>
              <select
                value={targetTypeFilter}
                onChange={(e) => {
                  navigate({
                    resetScroll: false,
                    search: {
                      ...search,
                      targetType: e.target.value || undefined,
                      page: 0,
                    },
                  })
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All types</option>
                <option value="user">User</option>
                <option value="role">Role</option>
                <option value="banner">Banner</option>
                <option value="feed_entry">Feed Entry</option>
                <option value="feedback">Feedback</option>
              </select>
            </div>
          </FilterBar>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-2xl text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Audit Logs
            </h1>
            {auditQuery.isFetching && (
              <Spinner className="text-gray-500 dark:text-gray-400" />
            )}
          </div>

          {/* Stats Cards */}
          {auditQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Records
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {auditQuery.data.counts.total.toLocaleString()}
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

          {(!auditQuery.data || auditQuery.data?.page.length === 0) && (
            <div className="text-center py-12">
              <Shield className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No audit records found
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Admin actions will be recorded here.
              </p>
            </div>
          )}

          {/* Pagination */}
          {auditQuery?.data && auditQuery.data.page.length > 0 && (
            <PaginationControls
              currentPage={currentPageIndex}
              totalPages={auditQuery.data.counts.pages}
              totalItems={auditQuery.data.counts.total}
              pageSize={pageSize}
              onPageChange={(page) => {
                navigate({
                  resetScroll: false,
                  search: { ...search, page },
                })
              }}
              onPageSizeChange={(newPageSize) => {
                navigate({
                  resetScroll: false,
                  search: {
                    ...search,
                    pageSize: newPageSize,
                    page: 0,
                  },
                })
              }}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              itemLabel="records"
              sticky
            />
          )}
        </div>
      </div>
    </div>
  )
}
