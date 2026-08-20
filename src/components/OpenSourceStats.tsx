import { useQuery } from '@tanstack/react-query'
import {
  CalendarDotsIcon,
  DownloadSimpleIcon,
  StarIcon,
} from '@phosphor-icons/react'
import { homepageNpmStatsSummaryQuery, ossStatsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { StatsSection, type StatItem, type StatsPage } from '~/components/ds/ui'

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
  page = 'home',
}: {
  className?: string
  page?: StatsPage
}) {
  const { data: stats, isLoading } = useQuery(ossStatsQuery())
  const { data: homepageNpmSummary, isLoading: isLoadingHomepageNpmSummary } =
    useQuery(homepageNpmStatsSummaryQuery())

  const npmDownloads = homepageNpmSummary?.totalDownloads ?? 0
  const starCount = stats?.github?.starCount ?? 0
  const weeklyDownloads = homepageNpmSummary?.weeklyDownloads ?? 0
  const weeklyRatePerDay = homepageNpmSummary?.weeklyRatePerDay

  // Live-ticking weekly counter — writes into the value node after mount.
  const weeklyRef = useNpmDownloadCounter({
    totalDownloads: weeklyDownloads,
    ratePerDay: weeklyRatePerDay ?? 0,
  })

  const hasNpmDownloads =
    !isLoadingHomepageNpmSummary && isValidMetric(npmDownloads)
  const hasStarCount = !isLoading && isValidMetric(starCount)
  const hasWeeklyDownloads =
    !isLoadingHomepageNpmSummary && isValidMetric(weeklyDownloads)

  const loading = isLoading || !stats
  const npmLoading = isLoadingHomepageNpmSummary || !homepageNpmSummary
  const weeklyLoading = isLoadingHomepageNpmSummary || !homepageNpmSummary

  const items: Array<StatItem> = []

  if (npmLoading || hasNpmDownloads) {
    items.push({
      key: 'total',
      icon: <DownloadSimpleIcon weight="regular" />,
      value: hasNpmDownloads ? formatCompact(npmDownloads) : '',
      placeholder: '00.0B',
      label: 'Total Downloads',
    })
  }

  if (weeklyLoading || hasWeeklyDownloads) {
    items.push({
      key: 'weekly',
      icon: <CalendarDotsIcon weight="regular" />,
      value: hasWeeklyDownloads ? weeklyDownloads.toLocaleString() : '',
      placeholder: '00,000,000',
      label: 'Weekly Downloads',
      // Only hand the ticking counter a node once there's a real base value —
      // otherwise it would write "0" over the empty placeholder while loading.
      valueRef: hasWeeklyDownloads ? weeklyRef : undefined,
    })
  }

  if (loading || hasStarCount) {
    items.push({
      key: 'stars',
      icon: <StarIcon weight="regular" />,
      value: hasStarCount ? starCount.toLocaleString() : '',
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
      layout="landscape"
      stats={items}
    />
  )
}
