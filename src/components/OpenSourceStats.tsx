import NumberFlow from '@number-flow/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  CalendarDotsIcon,
  DownloadSimpleIcon,
  StarIcon,
} from '@phosphor-icons/react'
import { type Library } from '~/libraries'
import {
  homepageNpmStatsSummaryQuery,
  ossStatsQuery,
  recentDownloadsQuery,
} from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import {
  StatsSection,
  type StatItem,
  type StatsLayout,
  type StatsPage,
} from '~/components/ds/ui'
import { tanStackTotalNpmStatsLibrary } from '~/utils/tanstack-npm-stats'

export type HomepageStatsSnapshot = {
  totalDownloads?: number
  weeklyDownloads?: number
  weeklyRatePerDay?: number
  starCount?: number
}

function WeeklyDownloadNumber({
  value,
  ratePerDay,
}: {
  value: number
  ratePerDay: number
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const isLive = ratePerDay > 0

  useEffect(() => {
    if (!isLive) return

    const startedAt = Date.now()
    const tick = () => {
      if (!document.hidden) {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
      }
    }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [isLive])

  return (
    <NumberFlow
      value={Math.round(value + (ratePerDay * elapsedSeconds) / 86_400)}
      locales="en-US"
      transformTiming={{ duration: 450, easing: 'ease-out' }}
    />
  )
}

/** Compact count with a single-letter magnitude, e.g. 2_340_000_000 → "2.3B". */
function formatCompact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return value.toLocaleString()
}

function isValidMetric(value: number | undefined | null): boolean {
  return (
    value !== undefined &&
    value !== null &&
    !Number.isNaN(value) &&
    value > 0 &&
    Number.isFinite(value)
  )
}

export default function OssStats({
  className,
  layout = 'landscape',
  library,
  page = 'home',
  initialStats,
}: {
  className?: string
  layout?: StatsLayout
  library?: Library
  page?: StatsPage
  initialStats?: HomepageStatsSnapshot
}) {
  const { data: stats, isLoading } = useQuery(ossStatsQuery({ library }))
  const { data: homepageNpmSummary, isLoading: isLoadingHomepageNpmSummary } =
    useQuery({
      ...homepageNpmStatsSummaryQuery(),
      enabled: !library,
    })
  const { data: recentDownloads, isLoading: isLoadingRecentDownloads } =
    useQuery({
      ...recentDownloadsQuery({
        library: library ?? tanStackTotalNpmStatsLibrary,
      }),
      enabled: Boolean(library),
    })

  const totalNpmStats = stats?.npm
  const npmDownloads = library
    ? (totalNpmStats?.totalDownloads ?? 0)
    : (homepageNpmSummary?.totalDownloads ?? initialStats?.totalDownloads ?? 0)
  const starCount = stats?.github?.starCount ?? initialStats?.starCount ?? 0
  const weeklyDownloads = library
    ? (recentDownloads?.weeklyDownloads ?? 0)
    : (homepageNpmSummary?.weeklyDownloads ??
      initialStats?.weeklyDownloads ??
      0)
  const weeklyRatePerDay = library
    ? undefined
    : (homepageNpmSummary?.weeklyRatePerDay ?? initialStats?.weeklyRatePerDay)
  const animate = page === 'hero' && !library

  const weeklyRef = useNpmDownloadCounter({
    totalDownloads: weeklyDownloads,
    ratePerDay: weeklyRatePerDay ?? 0,
  })

  const hasNpmDownloads = isValidMetric(npmDownloads)
  const hasStarCount = isValidMetric(starCount)
  const hasWeeklyDownloads = isValidMetric(weeklyDownloads)

  const loading = isLoading || !stats
  const npmLoading = library
    ? isLoading || !totalNpmStats
    : isLoadingHomepageNpmSummary || !homepageNpmSummary
  const weeklyLoading = library
    ? isLoadingRecentDownloads || !recentDownloads
    : isLoadingHomepageNpmSummary || !homepageNpmSummary
  const missingValue = animate ? '—' : ''

  const items: Array<StatItem> = []

  if (animate || npmLoading || hasNpmDownloads) {
    items.push({
      key: 'total',
      icon: <DownloadSimpleIcon weight="regular" />,
      value: hasNpmDownloads ? (
        animate ? (
          <NumberFlow
            value={npmDownloads}
            locales="en-US"
            format={{
              notation: 'compact',
              minimumFractionDigits: npmDownloads >= 1_000_000 ? 1 : 0,
              maximumFractionDigits: npmDownloads >= 1_000_000 ? 1 : 0,
            }}
          />
        ) : (
          formatCompact(npmDownloads)
        )
      ) : (
        missingValue
      ),
      placeholder: '00.0B',
      label: 'Total Downloads',
    })
  }

  if (animate || weeklyLoading || hasWeeklyDownloads) {
    items.push({
      key: 'weekly',
      icon: <CalendarDotsIcon weight="regular" />,
      value: hasWeeklyDownloads ? (
        animate ? (
          <WeeklyDownloadNumber
            value={weeklyDownloads}
            ratePerDay={weeklyRatePerDay ?? 0}
          />
        ) : (
          weeklyDownloads.toLocaleString()
        )
      ) : (
        missingValue
      ),
      placeholder: '00,000,000',
      label: 'Weekly Downloads',
      valueRef: hasWeeklyDownloads && !animate ? weeklyRef : undefined,
    })
  }

  if (animate || loading || hasStarCount) {
    items.push({
      key: 'stars',
      icon: <StarIcon weight="regular" />,
      value: hasStarCount ? (
        animate ? (
          <NumberFlow value={starCount} locales="en-US" />
        ) : (
          starCount.toLocaleString()
        )
      ) : (
        missingValue
      ),
      placeholder: '000,000',
      label: 'GitHub Stars',
    })
  }

  if (!loading && !npmLoading && !weeklyLoading && items.length === 0) {
    return null
  }

  return (
    <StatsSection
      className={className}
      page={page}
      layout={layout}
      stats={items}
    />
  )
}
