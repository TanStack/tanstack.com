import { useQuery } from '@tanstack/react-query'
import { Download, Star, TrendUp } from '@phosphor-icons/react'
import { type Library } from '~/libraries'
import {
  homepageNpmStatsSummaryQuery,
  ossStatsQuery,
  recentDownloadsQuery,
} from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { StatsSection, type StatItem } from '~/components/ds/ui'
import { tanStackTotalNpmStatsLibrary } from '~/utils/tanstack-npm-stats'

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

export default function OssStats({ library }: { library?: Library }) {
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
    : (homepageNpmSummary?.totalDownloads ?? 0)
  const starCount = stats?.github?.starCount ?? 0
  const weeklyDownloads = library
    ? (recentDownloads?.weeklyDownloads ?? 0)
    : (homepageNpmSummary?.weeklyDownloads ?? 0)
  const weeklyRatePerDay = library
    ? undefined
    : homepageNpmSummary?.weeklyRatePerDay

  // Live-ticking weekly counter — writes into the value node after mount.
  const weeklyRef = useNpmDownloadCounter({
    totalDownloads: weeklyDownloads,
    ratePerDay: weeklyRatePerDay ?? 0,
  })

  const hasNpmDownloads =
    !(library ? isLoading : isLoadingHomepageNpmSummary) &&
    isValidMetric(npmDownloads)
  const hasStarCount = !isLoading && isValidMetric(starCount)
  const hasWeeklyDownloads =
    !(library ? isLoadingRecentDownloads : isLoadingHomepageNpmSummary) &&
    isValidMetric(weeklyDownloads)

  const loading = isLoading || !stats
  const npmLoading = library
    ? isLoading || !totalNpmStats
    : isLoadingHomepageNpmSummary || !homepageNpmSummary
  const weeklyLoading = library
    ? isLoadingRecentDownloads || !recentDownloads
    : isLoadingHomepageNpmSummary || !homepageNpmSummary

  const items: Array<StatItem> = []

  if (npmLoading || hasNpmDownloads) {
    items.push({
      key: 'total',
      icon: <TrendUp weight="regular" />,
      value: hasNpmDownloads ? formatCompact(npmDownloads) : '',
      placeholder: '00.0B',
      label: 'Total Downloads',
    })
  }

  if (weeklyLoading || hasWeeklyDownloads) {
    items.push({
      key: 'weekly',
      icon: <Download weight="regular" />,
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
      icon: <Star weight="regular" />,
      value: hasStarCount ? starCount.toLocaleString() : '',
      placeholder: '000,000',
      label: 'GitHub Stars',
    })
  }

  if (!loading && !npmLoading && !weeklyLoading && items.length === 0) {
    return null
  }

  return <StatsSection page="home" layout="landscape" stats={items} />
}
