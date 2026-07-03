import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ArrowsClockwise } from '@phosphor-icons/react'
import { Card } from '~/components/Card'
import { NpmIcon } from '~/components/icons/NpmIcon'
import { homepageNpmStatsSummaryQuery } from '~/queries/stats'
import { Button } from '~/ui'
import { refreshAllNpmStats } from '~/utils/stats-admin.functions'
import { formatDistanceToNow } from '~/utils/dates'

export const Route = createFileRoute('/admin/npm-stats')({
  component: NpmStatsAdmin,
})

function NpmStatsAdmin() {
  const queryClient = useQueryClient()
  const { data: homepageSummary, isLoading: homepageSummaryLoading } = useQuery(
    homepageNpmStatsSummaryQuery(),
  )

  const refreshSummaryMutation = useMutation({
    mutationFn: () => refreshAllNpmStats({ data: { org: 'tanstack' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['stats', 'homepage-npm-summary'],
      })
      queryClient.invalidateQueries({ queryKey: ['stats', 'oss'] })
    },
  })

  return (
    <div className="w-full p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <NpmIcon className="text-2xl text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                NPM Stats Management
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Refresh and inspect the cached NPM summary used by homepage and
              library counters.
            </p>
          </div>
          <Button
            color="green"
            disabled={refreshSummaryMutation.isPending}
            onClick={() => refreshSummaryMutation.mutate()}
            title="Refresh the NPM summary cache from NPM stats chunks"
          >
            <ArrowsClockwise
              className={refreshSummaryMutation.isPending ? 'animate-spin' : ''}
            />
            {refreshSummaryMutation.isPending
              ? 'Refreshing...'
              : 'Refresh Summary'}
          </Button>
        </div>

        {homepageSummaryLoading ? (
          <div className="py-8 text-center text-gray-600 dark:text-gray-400">
            Loading NPM summary...
          </div>
        ) : homepageSummary ? (
          <>
            <Card className="mb-8 rounded-xl border-cyan-200 bg-gradient-to-br from-cyan-50 to-emerald-50 p-6 dark:border-cyan-800 dark:from-cyan-900/20 dark:to-emerald-900/20">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">
                    Cached NPM Summary
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total uses all known TanStack packages. Weekly uses the
                    TanStack Total preset packages.
                  </p>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                    Last Updated
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {formatDistanceToNow(new Date(homepageSummary.updatedAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <SummaryMetric
                  iconClassName="text-emerald-500"
                  label="Total Downloads"
                  value={homepageSummary.totalDownloads.toLocaleString()}
                  detail={`${homepageSummary.totalPackageCount.toLocaleString()} packages`}
                />
                <SummaryMetric
                  iconClassName="text-cyan-500"
                  label="Weekly Downloads"
                  value={homepageSummary.weeklyDownloads.toLocaleString()}
                  valueClassName="text-cyan-600 dark:text-cyan-400"
                  detail={`${homepageSummary.weeklyPackageCount.toLocaleString()} preset packages`}
                />
                <SummaryMetric
                  label="Weekly Window"
                  value={homepageSummary.weeklyStartDate}
                  detail={`through ${homepageSummary.weeklyEndDate}`}
                />
                <SummaryMetric
                  label="Cache Status"
                  value={
                    homepageSummary.expiresAt < Date.now() ? 'Stale' : 'Fresh'
                  }
                  valueClassName={
                    homepageSummary.expiresAt < Date.now()
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }
                  detail={`expires ${formatDistanceToNow(
                    new Date(homepageSummary.expiresAt),
                    { addSuffix: true },
                  )}`}
                />
              </div>
            </Card>

            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                Library Totals
              </h2>
              {homepageSummary.librarySummaries.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[...homepageSummary.librarySummaries]
                    .sort((a, b) => b.totalDownloads - a.totalDownloads)
                    .map((summary) => (
                      <Card key={summary.libraryId} className="p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {summary.libraryId}
                          </h3>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {summary.packageCount.toLocaleString()} packages
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Download className="size-5 text-emerald-500" />
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {summary.totalDownloads.toLocaleString()}
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              ) : (
                <Card className="p-6 text-center text-gray-600 dark:text-gray-400">
                  Refresh the summary to populate library totals.
                </Card>
              )}
            </div>
          </>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-yellow-800 dark:text-yellow-400">
              No NPM summary is cached yet.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

function SummaryMetric({
  detail,
  iconClassName,
  label,
  value,
  valueClassName,
}: {
  detail: string
  iconClassName?: string
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg bg-white/60 p-4 dark:bg-gray-800/60">
      <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        {label}
      </div>
      <div className="flex items-center gap-3">
        {iconClassName ? <Download className={iconClassName} /> : null}
        <div
          className={`text-2xl font-bold text-gray-900 dark:text-white ${valueClassName ?? ''}`}
        >
          {value}
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {detail}
      </div>
    </div>
  )
}
