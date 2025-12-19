import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
import {
  listGitHubStatsCache,
  refreshGitHubStats,
  refreshAllGitHubStats,
} from '~/utils/stats-admin.server'
import { formatDistanceToNow } from 'date-fns'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { Box, RefreshCw, Star, Users } from 'lucide-react'

type GitHubStatsEntry = {
  cacheKey: string
  stats: {
    starCount: number
    contributorCount: number
    dependentCount?: number
    forkCount?: number
    repositoryCount?: number
  }
  previousStats: {
    starCount: number
    contributorCount: number
    dependentCount?: number
    forkCount?: number
    repositoryCount?: number
  } | null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export const Route = createFileRoute('/admin/github-stats')({
  component: GitHubStatsAdmin,
})

function GitHubStatsAdmin() {
  const queryClient = useQueryClient()

  const { data: cacheEntries, isLoading } = useQuery({
    queryKey: ['admin', 'github-stats-cache'],
    queryFn: () => listGitHubStatsCache({ data: {} }),
  })

  const [refreshingKey, setRefreshingKey] = useState<string | null>(null)

  const refreshMutation = useMutation({
    mutationFn: (cacheKey: string) =>
      refreshGitHubStats({ data: { cacheKey } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'github-stats-cache'],
      })
      setRefreshingKey(null)
    },
    onError: () => {
      setRefreshingKey(null)
    },
  })

  const refreshAllMutation = useMutation({
    mutationFn: () => refreshAllGitHubStats({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'github-stats-cache'],
      })
    },
  })

  const columns = useMemo<ColumnDef<GitHubStatsEntry>[]>(
    () => [
      {
        accessorKey: 'cacheKey',
        header: 'Repository/Org',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900 dark:text-white">
            {row.original.cacheKey}
          </div>
        ),
      },
      {
        accessorKey: 'stats.starCount',
        header: 'Stars',
        cell: ({ row }) => {
          const entry = row.original
          const delta =
            entry.previousStats &&
            entry.stats.starCount - entry.previousStats.starCount
          return (
            <div>
              <div className="flex items-center gap-2">
                <Star className="text-yellow-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {entry.stats.starCount.toLocaleString()}
                </span>
              </div>
              {delta !== null && delta !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {delta >= 0 ? '+' : ''}
                  {delta.toLocaleString()}
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'stats.contributorCount',
        header: 'Contributors',
        cell: ({ row }) => {
          const entry = row.original
          const delta =
            entry.previousStats &&
            entry.stats.contributorCount - entry.previousStats.contributorCount
          return (
            <div>
              <div className="flex items-center gap-2">
                <Users className="text-blue-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {entry.stats.contributorCount.toLocaleString()}
                </span>
              </div>
              {delta !== null && delta !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {delta >= 0 ? '+' : ''}
                  {delta.toLocaleString()}
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'stats.dependentCount',
        header: 'Dependents',
        cell: ({ row }) => {
          const entry = row.original
          // Check if dependent count is available
          if (entry.stats.dependentCount === undefined) {
            return (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                Loading...
              </div>
            )
          }
          const delta =
            entry.previousStats &&
            entry.stats.dependentCount !== undefined &&
            entry.previousStats.dependentCount !== undefined
              ? entry.stats.dependentCount - entry.previousStats.dependentCount
              : null
          return (
            <div>
              <div className="flex items-center gap-2">
                <Box className="text-purple-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {entry.stats.dependentCount.toLocaleString()}
                </span>
              </div>
              {delta !== null && delta !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {delta >= 0 ? '+' : ''}
                  {delta.toLocaleString()}
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'stats.forkCount',
        header: 'Forks',
        cell: ({ row }) => {
          const entry = row.original
          if (entry.stats.forkCount === undefined) {
            return (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                N/A
              </div>
            )
          }
          const delta =
            entry.previousStats && entry.previousStats.forkCount !== undefined
              ? entry.stats.forkCount - entry.previousStats.forkCount
              : null
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {entry.stats.forkCount.toLocaleString()}
                </span>
              </div>
              {delta !== null && delta !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {delta >= 0 ? '+' : ''}
                  {delta.toLocaleString()}
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'stats.repositoryCount',
        header: 'Repos',
        cell: ({ row }) => {
          const entry = row.original
          if (entry.stats.repositoryCount === undefined) {
            return (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                N/A
              </div>
            )
          }
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {entry.stats.repositoryCount.toLocaleString()}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'expiresAt',
        header: 'Status',
        cell: ({ row }) => {
          const entry = row.original
          const isExpired = entry.expiresAt < new Date()
          return (
            <div className="text-sm">
              <div
                className={
                  isExpired
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : 'text-green-600 dark:text-green-400 font-medium'
                }
              >
                {isExpired ? 'Expired' : 'Valid'}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {formatDistanceToNow(new Date(entry.expiresAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatDistanceToNow(new Date(row.original.updatedAt), {
              addSuffix: true,
            })}
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const isRefreshing = refreshingKey === row.original.cacheKey
          return (
            <button
              onClick={() => {
                setRefreshingKey(row.original.cacheKey)
                refreshMutation.mutate(row.original.cacheKey)
              }}
              disabled={isRefreshing || refreshAllMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <RefreshCw
                className={isRefreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          )
        },
      },
    ],
    [refreshingKey, refreshAllMutation, refreshMutation],
  )

  const table = useReactTable({
    data: cacheEntries ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="w-full p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <GithubIcon className="text-2xl text-gray-900 dark:text-white" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              GitHub Stats Management
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View and refresh cached GitHub statistics for repositories and
            organizations.
          </p>
        </div>
        {cacheEntries && cacheEntries.length > 0 && (
          <button
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending || refreshingKey !== null}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw
              className={refreshAllMutation.isPending ? 'animate-spin' : ''}
            />
            Refresh All
          </button>
        )}
      </div>

      {refreshAllMutation.data && (
        <div className="mb-4 space-y-2">
          <div
            className={`p-4 rounded-lg ${
              refreshAllMutation.data.failed > 0
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
            }`}
          >
            Refreshed {refreshAllMutation.data.refreshed} entries
            {refreshAllMutation.data.failed > 0 &&
              `, ${refreshAllMutation.data.failed} failed`}
          </div>
          {refreshAllMutation.data.errors &&
            refreshAllMutation.data.errors.length > 0 && (
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <div className="font-semibold text-red-800 dark:text-red-400 mb-2">
                  Failed Entries:
                </div>
                <div className="space-y-1 text-sm">
                  {refreshAllMutation.data.errors.map(
                    (error: any, idx: number) => (
                      <div key={idx} className="text-red-700 dark:text-red-300">
                        <span className="font-medium">{error.cacheKey}:</span>{' '}
                        {error.error}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      ) : !cacheEntries || cacheEntries.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <p className="text-gray-600 dark:text-gray-400">
            No GitHub stats cache entries found.
          </p>
        </div>
      ) : (
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
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
