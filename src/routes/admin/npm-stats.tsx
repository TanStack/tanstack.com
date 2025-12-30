import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
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
  listNpmPackages,
  refreshNpmPackageStats,
  listNpmOrgStatsCache,
  getLibraryNpmStats,
  refreshAllNpmStats,
} from '~/utils/stats-admin.server'
import { formatDistanceToNow } from 'date-fns'
import { Download, RefreshCw } from 'lucide-react'
import { NpmIcon } from '~/components/icons/NpmIcon'
import { Card } from '~/components/Card'

type NpmPackage = {
  id: string
  packageName: string
  githubRepo: string | null
  libraryId: string | null
  isLegacy: boolean | null
  downloads: number | null
  ratePerDay: number | null
  statsExpiresAt: Date | null
  metadataCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type LibraryStats = {
  libraryId: string
  libraryName: string
  packageCount: number
  totalDownloads: number
  previousTotalDownloads: number | null
  ratePerDay: number | null
}

export const Route = createFileRoute('/admin/npm-stats')({
  component: NpmStatsAdmin,
})

function NpmStatsAdmin() {
  const queryClient = useQueryClient()

  const { data: orgCacheEntries, isLoading: orgLoading } = useQuery({
    queryKey: ['admin', 'npm-org-stats-cache'],
    queryFn: () => listNpmOrgStatsCache(),
  })

  const { data: libraryStats, isLoading: libraryStatsLoading } = useQuery({
    queryKey: ['admin', 'library-npm-stats'],
    queryFn: () => getLibraryNpmStats(),
  })

  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['admin', 'npm-packages'],
    queryFn: () => listNpmPackages({ data: {} }),
  })

  const refreshPackageMutation = useMutation({
    mutationFn: (packageName: string) =>
      refreshNpmPackageStats({ data: { packageName } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'npm-packages'] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'library-npm-stats'],
      })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'npm-org-stats-cache'],
      })
    },
  })

  const refreshAllMutation = useMutation({
    mutationFn: (org: string) => {
      console.log('[Admin UI] Starting refresh for org:', org)
      return refreshAllNpmStats({ data: { org } })
    },
    onSuccess: (data) => {
      console.log('[Admin UI] Refresh succeeded:', data)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (error) => {
      console.error('[Admin UI] Refresh failed:', error)
    },
  })

  const orgStats = orgCacheEntries?.[0]

  const libraryColumns = useMemo<ColumnDef<LibraryStats>[]>(
    () => [
      {
        accessorKey: 'libraryName',
        header: 'Library',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900 dark:text-white">
            {row.original.libraryName}
          </div>
        ),
      },
      {
        accessorKey: 'packageCount',
        header: 'Packages',
        cell: ({ row }) => (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {row.original.packageCount}
          </div>
        ),
      },
      {
        accessorKey: 'totalDownloads',
        header: 'Total Downloads',
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <Download className="text-emerald-500" />
              <span className="font-semibold text-gray-900 dark:text-white">
                {row.original.totalDownloads.toLocaleString()}
              </span>
            </div>
            {row.original.ratePerDay !== null &&
              row.original.ratePerDay > 0 && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  {Math.round(row.original.ratePerDay).toLocaleString()}/day
                </div>
              )}
          </div>
        ),
      },
    ],
    [],
  )

  const packageColumns = useMemo<ColumnDef<NpmPackage>[]>(
    () => [
      {
        accessorKey: 'packageName',
        header: 'Package',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {row.original.packageName}
            </div>
            {row.original.isLegacy && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded">
                Legacy
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'githubRepo',
        header: 'GitHub Repo',
        cell: ({ row }) => (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {row.original.githubRepo || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'libraryId',
        header: 'Library',
        cell: ({ row }) => (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {row.original.libraryId || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'downloads',
        header: 'Downloads',
        cell: ({ row }) => {
          const pkg = row.original
          return (
            <div>
              <div className="flex items-center gap-2">
                <Download className="text-emerald-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {pkg.downloads?.toLocaleString() ?? 'N/A'}
                </span>
              </div>
              {pkg.ratePerDay !== null && pkg.ratePerDay > 0 && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  {Math.round(pkg.ratePerDay).toLocaleString()}/day
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'statsExpiresAt',
        header: 'Status',
        cell: ({ row }) => {
          const pkg = row.original
          if (!pkg.statsExpiresAt)
            return <span className="text-gray-500">-</span>
          const isExpired = pkg.statsExpiresAt < new Date()
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
                {isExpired ? (
                  <>
                    Expired{' '}
                    {formatDistanceToNow(new Date(pkg.statsExpiresAt), {
                      addSuffix: true,
                    })}
                  </>
                ) : (
                  <>
                    expires{' '}
                    {formatDistanceToNow(new Date(pkg.statsExpiresAt), {
                      addSuffix: true,
                    })}
                  </>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <button
            onClick={() =>
              refreshPackageMutation.mutate(row.original.packageName)
            }
            disabled={refreshPackageMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <RefreshCw
              className={refreshPackageMutation.isPending ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        ),
      },
    ],
    [refreshPackageMutation],
  )

  const libraryTable = useReactTable({
    data: libraryStats ?? [],
    columns: libraryColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const packagesTable = useReactTable({
    data: packagesData?.packages ?? [],
    columns: packageColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const packages = packagesData?.packages ?? []

  return (
    <div className="w-full p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <NpmIcon className="text-2xl text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                NPM Stats Management
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View cached NPM statistics. Click "Refresh All Stats" to discover
              packages, fetch fresh download counts with growth rates, and
              rebuild all caches.
            </p>
          </div>
          <button
            onClick={() => {
              console.log('[Admin UI] Refresh button clicked')
              refreshAllMutation.mutate('tanstack')
            }}
            disabled={refreshAllMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            title="Complete refresh: discover packages, fetch fresh stats with growth rates, and rebuild all caches"
          >
            <RefreshCw
              className={refreshAllMutation.isPending ? 'animate-spin' : ''}
            />
            {refreshAllMutation.isPending
              ? 'Refreshing...'
              : 'Refresh All Stats'}
          </button>
        </div>

        {/* Org Stats Section - Top of Page */}
        {orgLoading ? (
          <div className="text-center py-8 mb-8">
            <div className="text-gray-600 dark:text-gray-400">
              Loading org stats...
            </div>
          </div>
        ) : orgStats ? (
          <Card className="mb-8 p-6 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-xl border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  @{orgStats.orgName} Organization
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total statistics across all packages
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Last Updated
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {formatDistanceToNow(new Date(orgStats.updatedAt), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Total Downloads
                </div>
                <div className="flex items-center gap-3">
                  <Download className="text-2xl text-emerald-500" />
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {orgStats.totalDownloads.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Downloads Per Day
                </div>
                <div className="flex items-center gap-3">
                  <Download className="text-2xl text-emerald-500" />
                  <div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {orgStats.ratePerDay !== undefined &&
                      orgStats.ratePerDay > 0
                        ? Math.round(orgStats.ratePerDay).toLocaleString()
                        : '0'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Average daily rate
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Total Packages
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {orgStats.packageStats &&
                  typeof orgStats.packageStats === 'object'
                    ? Object.keys(orgStats.packageStats).length.toLocaleString()
                    : '0'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Across all libraries
                </div>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Cache Status
                </div>
                <div
                  className={`text-2xl font-bold mb-1 ${
                    orgStats.expiresAt < new Date()
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {orgStats.expiresAt < new Date() ? 'Expired' : 'Valid'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {orgStats.expiresAt < new Date() ? (
                    <>
                      Expired{' '}
                      {formatDistanceToNow(new Date(orgStats.expiresAt), {
                        addSuffix: true,
                      })}
                    </>
                  ) : (
                    <>
                      expires{' '}
                      {formatDistanceToNow(new Date(orgStats.expiresAt), {
                        addSuffix: true,
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="text-center">
              <p className="text-yellow-800 dark:text-yellow-400 font-medium">
                No org stats available. Click "Refresh All Stats" to populate.
              </p>
            </div>
          </Card>
        )}

        {/* Library Stats Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Library Stats
          </h2>
          {libraryStatsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-600 dark:text-gray-400">
                Loading library stats...
              </div>
            </div>
          ) : libraryStats && libraryStats.length > 0 ? (
            <Table>
              <TableHeader>
                {libraryTable.getHeaderGroups().map((headerGroup) => (
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
                {libraryTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
          ) : (
            <Card className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                No library stats available.
              </p>
            </Card>
          )}
        </div>

        {/* Packages Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            All Packages
          </h2>
          {packagesLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-600 dark:text-gray-400">Loading...</div>
            </div>
          ) : packages.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                No packages found.
              </p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                {packagesTable.getHeaderGroups().map((headerGroup) => (
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
                {packagesTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
          )}
        </div>
      </div>
    </div>
  )
}
