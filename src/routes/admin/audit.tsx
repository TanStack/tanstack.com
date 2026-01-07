import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { PaginationControls } from '~/components/PaginationControls'
import { AuditTopBarFilters } from '~/components/AuditTopBarFilters'
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
import { listAuditLogs } from '~/utils/audit.functions'
import { Shield, ChevronDown, ChevronUp } from 'lucide-react'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
  AdminEmptyState,
  UserAvatar,
  StatsCard,
} from '~/components/admin'
import { useAdminGuard } from '~/hooks/useAdminGuard'

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
  validateSearch: (search) =>
    v.parse(
      v.object({
        actorId: v.optional(v.string()),
        action: v.optional(v.string()),
        targetType: v.optional(v.string()),
        page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
        pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
      }),
      search,
    ),
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
  const guard = useAdminGuard()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const actorIdFilter = search.actorId ?? ''
  const actionFilter = search.action ?? ''
  const targetTypeFilter = search.targetType ?? ''

  const currentPageIndex = search.page ?? 0
  const pageSize = search.pageSize ?? 25

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
              <UserAvatar image={entry.actorImage} name={entry.actorName} />
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
                <UserAvatar
                  image={entry.targetUserImage}
                  name={entry.targetUserName}
                  size="sm"
                />
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

  // Auth guard
  if (guard.status === 'loading') {
    return <AdminLoading />
  }
  if (guard.status === 'denied') {
    return <AdminAccessDenied />
  }

  const canGoPrevious = currentPageIndex > 0
  const canGoNext = !auditQuery?.data?.isDone

  return (
    <div className="w-full p-4">
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          icon={<Shield />}
          title="Audit Logs"
          isLoading={auditQuery.isFetching}
        />

        {/* Top Bar Filters */}
        <AuditTopBarFilters
          filters={{
            actorId: actorIdFilter || undefined,
            action: actionFilter || undefined,
            targetType: targetTypeFilter || undefined,
          }}
          onFilterChange={(newFilters) => {
            navigate({
              resetScroll: false,
              search: {
                ...search,
                ...newFilters,
                page: 0,
              },
            })
          }}
          onClearFilters={handleClearFilters}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Stats Cards */}
          {auditQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatsCard
                label="Total Records"
                value={auditQuery.data.counts.total}
              />
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
            <AdminEmptyState
              icon={<Shield className="w-12 h-12" />}
              title="No audit records found"
              description="Admin actions will be recorded here."
            />
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
