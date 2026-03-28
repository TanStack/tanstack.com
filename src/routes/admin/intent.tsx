import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw,
  Play,
  RotateCcw,
  Trash2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '~/ui'
import { Card } from '~/components/Card'
import { formatDistanceToNow } from '~/utils/dates'
import {
  getIntentAdminStats,
  listIntentPackages,
  listFailedVersions,
  triggerIntentDiscover,
  triggerIntentProcess,
  retryIntentVersion,
  deleteIntentPackage,
  resetFailedVersions,
  seedIntentPackage,
  discoverViaGitHub,
} from '~/utils/intent-admin.server'

export const Route = createFileRoute('/admin/intent')({
  component: IntentAdminPage,
})

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
const QK = {
  stats: ['admin', 'intent', 'stats'] as const,
  packages: ['admin', 'intent', 'packages'] as const,
  failed: ['admin', 'intent', 'failed'] as const,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function IntentAdminPage() {
  const queryClient = useQueryClient()
  const [seedInput, setSeedInput] = React.useState('')

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'intent'] })
  }

  const statsQuery = useQuery({
    queryKey: QK.stats,
    queryFn: () => getIntentAdminStats(),
    refetchInterval: 10_000,
  })

  const packagesQuery = useQuery({
    queryKey: QK.packages,
    queryFn: () => listIntentPackages(),
  })

  const failedQuery = useQuery({
    queryKey: QK.failed,
    queryFn: () => listFailedVersions(),
  })

  const discoverMutation = useMutation({
    mutationFn: () => triggerIntentDiscover(),
    onSuccess: invalidateAll,
  })

  const processMutation = useMutation({
    mutationFn: (limit: number) => triggerIntentProcess({ data: { limit } }),
    onSuccess: invalidateAll,
  })

  const resetFailedMutation = useMutation({
    mutationFn: () => resetFailedVersions(),
    onSuccess: invalidateAll,
  })

  const seedMutation = useMutation({
    mutationFn: (name: string) => seedIntentPackage({ data: { name } }),
    onSuccess: () => {
      setSeedInput('')
      invalidateAll()
    },
  })

  const githubDiscoverMutation = useMutation({
    mutationFn: () => discoverViaGitHub(),
    onSuccess: invalidateAll,
  })

  const stats = statsQuery.data

  return (
    <div className="w-full p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-sky-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Intent Skills Registry
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage discovery and processing of npm packages that ship Agent
            Skills via{' '}
            <code className="font-mono text-xs">tanstack-intent</code>.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            title="Search NPM for tanstack-intent keyword, verify packages, and enqueue"
          >
            <RefreshCw
              className={
                discoverMutation.isPending ? 'animate-spin w-4 h-4' : 'w-4 h-4'
              }
            />
            {discoverMutation.isPending ? 'Discovering...' : 'NPM Discovery'}
          </Button>
          <Button
            size="sm"
            onClick={() => githubDiscoverMutation.mutate()}
            disabled={githubDiscoverMutation.isPending}
            title="Search GitHub for repos with @tanstack/intent dependency and skills"
          >
            <RefreshCw
              className={
                githubDiscoverMutation.isPending
                  ? 'animate-spin w-4 h-4'
                  : 'w-4 h-4'
              }
            />
            {githubDiscoverMutation.isPending
              ? 'Searching GitHub...'
              : 'GitHub Discovery'}
          </Button>
          <Button
            size="sm"
            color="green"
            onClick={() => processMutation.mutate(10)}
            disabled={
              processMutation.isPending ||
              (stats?.pendingVersions ?? 0) + (stats?.failedVersions ?? 0) === 0
            }
            title="Download tarballs and extract skills for up to 10 pending versions"
          >
            <Play
              className={
                processMutation.isPending ? 'animate-pulse w-4 h-4' : 'w-4 h-4'
              }
            />
            {processMutation.isPending ? 'Processing...' : 'Process 10 Pending'}
          </Button>
          {(stats?.failedVersions ?? 0) > 0 && (
            <Button
              size="sm"
              color="red"
              variant="secondary"
              onClick={() => resetFailedMutation.mutate()}
              disabled={resetFailedMutation.isPending}
              title="Reset all failed versions back to pending so they'll be retried"
            >
              <RotateCcw className="w-4 h-4" />
              Reset {stats?.failedVersions} Failed
            </Button>
          )}
        </div>
      </div>

      {/* Manual seed form */}
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = seedInput.trim()
          if (name) seedMutation.mutate(name)
        }}
      >
        <input
          type="text"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="npm package name, e.g. @tanstack/db"
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <Button
          size="sm"
          type="submit"
          disabled={seedMutation.isPending || !seedInput.trim()}
          title="Manually seed a package by name, bypassing keyword discovery"
        >
          {seedMutation.isPending ? 'Seeding...' : 'Seed Package'}
        </Button>
      </form>

      {/* Mutation result banners */}
      {discoverMutation.data && (
        <ResultBanner
          title="Discovery complete"
          items={[
            `${discoverMutation.data.packagesDiscovered} found on NPM`,
            `${discoverMutation.data.packagesVerified} verified`,
            `${discoverMutation.data.versionsEnqueued} versions enqueued`,
            ...(discoverMutation.data.errors.length > 0
              ? [`${discoverMutation.data.errors.length} errors`]
              : []),
          ]}
          errors={discoverMutation.data.errors}
          onDismiss={() => discoverMutation.reset()}
        />
      )}
      {processMutation.data && (
        <ResultBanner
          title={`Processed ${processMutation.data.processed} version(s)`}
          items={processMutation.data.results.map(
            (r) =>
              `${r.packageName}@${r.version}: ${r.status === 'synced' ? `${r.skillCount} skills` : `FAILED — ${r.error}`}`,
          )}
          errors={processMutation.data.results
            .filter((r) => r.status === 'failed')
            .map((r) => `${r.packageName}@${r.version}: ${r.error}`)}
          onDismiss={() => processMutation.reset()}
        />
      )}
      {resetFailedMutation.data && (
        <ResultBanner
          title={`Reset ${resetFailedMutation.data.resetCount} failed version(s) to pending`}
          items={[]}
          errors={[]}
          onDismiss={() => resetFailedMutation.reset()}
        />
      )}
      {githubDiscoverMutation.data && (
        <ResultBanner
          title="GitHub discovery complete"
          items={[
            `${githubDiscoverMutation.data.searched} repos searched`,
            `${githubDiscoverMutation.data.checkedOnNpm} checked on NPM`,
            `${githubDiscoverMutation.data.hadSkills} had skills`,
            `${githubDiscoverMutation.data.enqueued} versions enqueued`,
            `${githubDiscoverMutation.data.skipped} skipped (no skills)`,
            ...(githubDiscoverMutation.data.errors.length > 0
              ? [`${githubDiscoverMutation.data.errors.length} errors`]
              : []),
          ]}
          errors={githubDiscoverMutation.data.errors}
          onDismiss={() => githubDiscoverMutation.reset()}
        />
      )}
      {seedMutation.data && (
        <ResultBanner
          title="Package seeded"
          items={[
            `${seedMutation.data.versionsEnqueued} version(s) enqueued for processing`,
          ]}
          errors={[]}
          onDismiss={() => seedMutation.reset()}
        />
      )}
      {seedMutation.isError && (
        <ResultBanner
          title="Seed failed"
          items={[]}
          errors={[
            seedMutation.error instanceof Error
              ? seedMutation.error.message
              : String(seedMutation.error),
          ]}
          onDismiss={() => seedMutation.reset()}
        />
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Total packages"
          value={stats?.totalPackages}
          loading={statsQuery.isLoading}
        />
        <StatCard
          label="Verified"
          value={stats?.verifiedPackages}
          loading={statsQuery.isLoading}
          color="green"
        />
        <StatCard
          label="Synced versions"
          value={stats?.syncedVersions}
          loading={statsQuery.isLoading}
          color="green"
        />
        <StatCard
          label="Pending"
          value={stats?.pendingVersions}
          loading={statsQuery.isLoading}
          color="yellow"
        />
        <StatCard
          label="Failed"
          value={stats?.failedVersions}
          loading={statsQuery.isLoading}
          color="red"
        />
        <StatCard
          label="Total skills"
          value={stats?.totalSkills}
          loading={statsQuery.isLoading}
          color="sky"
        />
      </div>

      {/* Failed versions (shown prominently when non-zero) */}
      {(failedQuery.data?.length ?? 0) > 0 && (
        <FailedVersionsSection
          versions={failedQuery.data ?? []}
          onRetry={invalidateAll}
        />
      )}

      {/* Package list */}
      <PackagesSection
        packages={packagesQuery.data ?? []}
        loading={packagesQuery.isLoading}
        onDelete={invalidateAll}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  loading,
  color = 'default',
}: {
  readonly label: string
  readonly value: number | undefined
  readonly loading: boolean
  readonly color?: 'default' | 'green' | 'yellow' | 'red' | 'sky'
}) {
  const valueClass = {
    default: 'text-gray-900 dark:text-white',
    green: 'text-emerald-600 dark:text-emerald-400',
    yellow: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    sky: 'text-sky-600 dark:text-sky-400',
  }[color]

  return (
    <Card className="p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 leading-tight">
        {label}
      </div>
      {loading ? (
        <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      ) : (
        <div className={`text-2xl font-bold tabular-nums ${valueClass}`}>
          {(value ?? 0).toLocaleString()}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Result banner
// ---------------------------------------------------------------------------
function ResultBanner({
  title,
  items,
  errors,
  onDismiss,
}: {
  readonly title: string
  readonly items: Array<string>
  readonly errors: Array<string>
  readonly onDismiss: () => void
}) {
  const hasErrors = errors.length > 0
  return (
    <div
      className={`mb-4 rounded-lg border p-3 text-sm ${
        hasErrors
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
          {hasErrors ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          {title}
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 text-xs"
        >
          dismiss
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 ml-6 space-y-0.5 text-gray-600 dark:text-gray-400">
          {items.map((item, i) => (
            <li
              key={i}
              className={
                errors.some(
                  (e) => item.includes('FAILED') || item.includes('error'),
                )
                  ? 'text-red-600 dark:text-red-400'
                  : ''
              }
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Failed versions section
// ---------------------------------------------------------------------------
function FailedVersionsSection({
  versions,
  onRetry,
}: {
  readonly versions: Array<{
    id: number
    packageName: string
    version: string
    failureReason: string | null
    createdAt: Date
  }>
  readonly onRetry: () => void
}) {
  const queryClient = useQueryClient()
  const retryMutation = useMutation({
    mutationFn: (versionId: number) =>
      retryIntentVersion({ data: { versionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intent'] })
      onRetry()
    },
  })

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-4 h-4" />
        Failed Versions
        <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-xs tabular-nums">
          {versions.length}
        </span>
      </h2>
      <div className="rounded-xl border border-red-200 dark:border-red-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-red-50 dark:bg-red-950/30">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                Package
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                Version
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 hidden sm:table-cell">
                Reason
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 hidden md:table-cell">
                Age
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100 dark:divide-red-900/50">
            {versions.map((v) => (
              <tr key={v.id} className="bg-white dark:bg-gray-900">
                <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                  {v.packageName}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                  {v.version}
                </td>
                <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400 max-w-xs truncate hidden sm:table-cell">
                  {v.failureReason ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400 hidden md:table-cell">
                  {formatDistanceToNow(v.createdAt, { addSuffix: true })}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => retryMutation.mutate(v.id)}
                    disabled={retryMutation.isPending}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Package list section
// ---------------------------------------------------------------------------
function PackagesSection({
  packages,
  loading,
  onDelete,
}: {
  readonly packages: Array<{
    name: string
    verified: boolean
    firstSeenAt: Date
    lastSyncedAt: Date
    versions: { pending: number; synced: number; failed: number }
  }>
  readonly loading: boolean
  readonly onDelete: () => void
}) {
  const [expandedPkg, setExpandedPkg] = React.useState<string | null>(null)

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        All Packages
        <span className="ml-2 text-gray-400 font-normal">
          {packages.length}
        </span>
      </h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No packages discovered yet. Run Discovery to search NPM.
        </Card>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  Package
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                  Versions
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 hidden md:table-cell">
                  Last synced
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {packages.map((pkg) => (
                <PackageRow
                  key={pkg.name}
                  pkg={pkg}
                  isExpanded={expandedPkg === pkg.name}
                  onToggle={() =>
                    setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)
                  }
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PackageRow({
  pkg,
  isExpanded,
  onToggle,
  onDelete,
}: {
  readonly pkg: {
    name: string
    verified: boolean
    firstSeenAt: Date
    lastSyncedAt: Date
    versions: { pending: number; synced: number; failed: number }
  }
  readonly isExpanded: boolean
  readonly onToggle: () => void
  readonly onDelete: () => void
}) {
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteIntentPackage({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intent'] })
      onDelete()
    },
  })

  const { pending, synced, failed } = pkg.versions
  const totalVersions = pending + synced + failed

  return (
    <tr
      className={`bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer`}
      onClick={onToggle}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          )}
          <span className="font-mono text-xs text-gray-900 dark:text-gray-100">
            {pkg.name}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        {pkg.verified ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" /> Unverified
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 text-xs tabular-nums">
          {synced > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              {synced} synced
            </span>
          )}
          {pending > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              {pending} pending
            </span>
          )}
          {failed > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
              {failed} failed
            </span>
          )}
          {totalVersions === 0 && <span className="text-gray-400">—</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 hidden md:table-cell">
        {formatDistanceToNow(pkg.lastSyncedAt, { addSuffix: true })}
      </td>
      <td
        className="px-3 py-2.5 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="secondary"
          color="red"
          onClick={() => {
            if (confirm(`Delete ${pkg.name} and all its versions?`)) {
              deleteMutation.mutate(pkg.name)
            }
          }}
          disabled={deleteMutation.isPending}
          title="Remove this package and all versions from the registry"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  )
}
