import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { BlankErrorBoundary } from './BlankErrorBoundary'
import type { LibrarySlim } from '~/libraries'
import { ossStatsQuery, recentDownloadStatsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

function isValidMetric(value: number | undefined | null): boolean {
  return (
    value !== undefined &&
    value !== null &&
    !Number.isNaN(value) &&
    value >= 0 &&
    Number.isFinite(value)
  )
}

function NpmStatsSummaryContent({ library }: { library: LibrarySlim }) {
  const { data: stats } = useSuspenseQuery(ossStatsQuery({ library }))
  const { data: recentStats } = useSuspenseQuery(
    recentDownloadStatsQuery({ library }),
  )

  const npmDownloads = stats.npm?.totalDownloads ?? 0
  const hasNpmDownloads = isValidMetric(npmDownloads)

  // Use actual data from the API
  const dailyDownloads = recentStats?.dailyDownloads ?? 0
  const weeklyDownloads = recentStats?.weeklyDownloads ?? 0
  const monthlyDownloads = recentStats?.monthlyDownloads ?? 0

  // IMPORTANT: useNpmDownloadCounter returns a ref callback, not state
  // Must be applied to a DOM element
  const counterRef = useNpmDownloadCounter(stats.npm)

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* All Time Downloads (Animated with ref callback) */}
        <div className="text-left">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 relative">
            {hasNpmDownloads ? <span ref={counterRef}>0</span> : <span>0</span>}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
            All Time Downloads
          </div>
        </div>

        {/* Monthly Downloads */}
        <div className="text-left">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(monthlyDownloads)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
            Monthly Downloads
          </div>
        </div>

        {/* Weekly Downloads */}
        <div className="text-left">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(weeklyDownloads)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
            Weekly Downloads
          </div>
        </div>

        {/* Daily Downloads */}
        <div className="text-left">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(dailyDownloads)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
            Daily Downloads
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NpmStatsSummaryBar({
  library,
}: {
  library: LibrarySlim
}) {
  return (
    <Suspense
      fallback={
        <div className="mb-6">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="text-left">
                    <div className="h-9 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-2"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      }
    >
      <BlankErrorBoundary>
        <NpmStatsSummaryContent library={library} />
      </BlankErrorBoundary>
    </Suspense>
  )
}
