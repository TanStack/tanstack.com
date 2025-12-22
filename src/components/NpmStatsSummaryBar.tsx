import { Suspense } from 'react'
import NumberFlow from '@number-flow/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { BlankErrorBoundary } from './BlankErrorBoundary'
import { Library } from '~/libraries'
import { ossStatsQuery, recentDownloadStatsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { Download, Calendar, TrendingUp } from 'lucide-react'

const StableCounter = ({
  value,
  intervalMs,
}: {
  value?: number
  intervalMs?: number
}) => {
  const dummyString = Number(
    Array(value?.toString().length ?? 1)
      .fill('8')
      .join(''),
  )

  return (
    <>
      {/* Dummy span to prevent layout shift */}
      <span className="opacity-0">{dummyString}</span>
      <span className="absolute -top-0.5 left-0">
        <NumberFlow
          // Defer to counter hook calculated interval
          spinTiming={{
            duration: intervalMs,
            easing: 'linear',
          }}
          // Slow horizontal shift animation (due to differing number widths)
          transformTiming={{
            duration: 1000,
            easing: 'linear',
          }}
          value={value}
          trend={1}
          continuous
          willChange
        />
      </span>
    </>
  )
}

const NpmDownloadCounter = ({
  npmData,
}: {
  npmData: {
    totalDownloads: number
    ratePerDay?: number
    updatedAt?: number
    tag?: string
  }
}) => {
  const { count, intervalMs } = useNpmDownloadCounter(npmData)
  if (!Number.isFinite(count)) {
    // this returns true for NaN, Infinity / -Infinity, null, undefined
    return '-'
  }
  return <StableCounter value={count} intervalMs={intervalMs} />
}

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

function NpmStatsSummaryContent({ 
  library
}: { 
  library: Library
}) {
  const { data: stats } = useSuspenseQuery(ossStatsQuery({ library }))
  const { data: recentStats } = useSuspenseQuery(recentDownloadStatsQuery({ library }))

  const npmDownloads = stats.npm?.totalDownloads ?? 0
  const hasNpmDownloads = isValidMetric(npmDownloads)

  // Use actual data from the new API
  const dailyDownloads = recentStats?.dailyDownloads ?? 0
  const weeklyDownloads = recentStats?.weeklyDownloads ?? 0
  const monthlyDownloads = recentStats?.monthlyDownloads ?? 0

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* All Time Downloads (Animated) */}
        <div className="text-left">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 relative">
            {hasNpmDownloads ? (
              <NpmDownloadCounter npmData={stats.npm} />
            ) : (
              <span>0</span>
            )}
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
  library
}: { 
  library: Library
}) {
  return (
    <Suspense fallback={
      <div className="mb-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="text-left">
                <div className="h-9 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <BlankErrorBoundary>
        <NpmStatsSummaryContent library={library} />
      </BlankErrorBoundary>
    </Suspense>
  )
}