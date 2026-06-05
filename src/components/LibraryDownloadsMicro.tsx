import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'
import type { LibrarySlim } from '~/libraries'
import { ossStatsQuery, recentDownloadsQuery } from '~/queries/stats'
import type { RecentDownloadStats } from '~/utils/stats.types'

type DownloadPeriod = 'daily' | 'monthly' | 'weekly'

type LibraryDownloadsMicroProps = {
  animateIncreaseTrend?: boolean
  className?: string
  label?: string
  labelClassName?: string
  library: LibrarySlim
  period?: DownloadPeriod
  showTotals?: boolean
  valueClassName?: string
}

const weekInMs = 7 * 24 * 60 * 60 * 1000
const statsRowClassName =
  'grid w-64 max-w-full grid-cols-[minmax(11ch,max-content)_auto] items-baseline gap-1.5 text-sm font-bold text-zinc-600 dark:text-zinc-400'

function hasDownloads(value: number | undefined | null): value is number {
  return (
    value !== undefined && value !== null && value > 0 && Number.isFinite(value)
  )
}

function getRecentDownloadTotal(
  stats: RecentDownloadStats | undefined,
  period: DownloadPeriod,
) {
  if (!stats) {
    return undefined
  }

  if (period === 'daily') {
    return stats.dailyDownloads
  }

  if (period === 'weekly') {
    return stats.weeklyDownloads
  }

  return stats.monthlyDownloads
}

function getWeeklyIncreaseTrendPerMs(stats: RecentDownloadStats | undefined) {
  if (!stats) {
    return 0
  }

  if (stats.weeklyDownloads <= 0 || !Number.isFinite(stats.weeklyDownloads)) {
    return 0
  }

  const weeklyIncrease = stats.weeklyDownloads - stats.previousWeeklyDownloads
  const positiveIncrease = Math.max(0, weeklyIncrease)

  return (stats.weeklyDownloads + positiveIncrease) / weekInMs
}

function useAnimatedDownloadTotal({
  animateIncreaseTrend,
  period,
  stats,
  totalDownloads,
}: {
  animateIncreaseTrend: boolean
  period: DownloadPeriod
  stats: RecentDownloadStats | undefined
  totalDownloads: number | undefined
}) {
  const [now, setNow] = React.useState(() => Date.now())
  const trendPerMs =
    animateIncreaseTrend && period === 'weekly'
      ? getWeeklyIncreaseTrendPerMs(stats)
      : 0

  React.useEffect(() => {
    if (!trendPerMs) {
      return
    }

    let frameId: number | undefined

    const updateNow = () => {
      setNow(Date.now())
      frameId = window.requestAnimationFrame(updateNow)
    }

    frameId = window.requestAnimationFrame(updateNow)

    return () => {
      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [trendPerMs])

  if (!hasDownloads(totalDownloads) || !stats || !trendPerMs) {
    return totalDownloads ?? 0
  }

  const elapsedMs = Math.max(0, now - stats.updatedAt)
  return Math.floor(totalDownloads + elapsedMs * trendPerMs)
}

function getWeeklyTrendDescription(stats: RecentDownloadStats | undefined) {
  if (!stats) {
    return undefined
  }

  const weeklyIncrease = stats.weeklyDownloads - stats.previousWeeklyDownloads

  if (weeklyIncrease <= 0 || !Number.isFinite(weeklyIncrease)) {
    return 'ticking at the current weekly download pace'
  }

  return `up ${weeklyIncrease.toLocaleString()} from the previous week`
}

function formatStatsLabel(label: string) {
  return label
    .split(' ')
    .map((word) => {
      if (word.toLowerCase() === 'github') {
        return 'GitHub'
      }

      if (word.toLowerCase() === 'npm') {
        return 'NPM'
      }

      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function formatAbbreviatedNumber(value: number) {
  const units = [
    { label: 'Billion', value: 1_000_000_000 },
    { label: 'Million', value: 1_000_000 },
    { label: 'Thousand', value: 1_000 },
  ]

  const unit = units.find((candidate) => Math.abs(value) >= candidate.value)

  if (!unit) {
    return value.toLocaleString()
  }

  return `${(value / unit.value).toFixed(1)} ${unit.label}`
}

export function LibraryDownloadsMicro({
  animateIncreaseTrend = false,
  className,
  label = 'monthly npm downloads',
  labelClassName,
  library,
  period = 'monthly',
  showTotals = false,
  valueClassName,
}: LibraryDownloadsMicroProps) {
  const { data: stats } = useQuery(recentDownloadsQuery({ library }))
  const { data: ossStats } = useQuery({
    ...ossStatsQuery({ library }),
    enabled: showTotals,
  })
  const totalDownloads = getRecentDownloadTotal(stats, period)
  const displayedDownloads = useAnimatedDownloadTotal({
    animateIncreaseTrend,
    period,
    stats,
    totalDownloads,
  })
  const hasNpmDownloads = hasDownloads(totalDownloads)
  const weeklyTrendDescription =
    animateIncreaseTrend && period === 'weekly'
      ? getWeeklyTrendDescription(stats)
      : undefined
  const totalDownloadCount = ossStats?.npm?.totalDownloads
  const starCount = ossStats?.github?.starCount
  const formattedLabel = formatStatsLabel(label)

  const micro = hasNpmDownloads ? (
    <span
      className={twMerge(
        showTotals
          ? statsRowClassName
          : 'inline-flex items-center gap-1.5 text-sm font-bold text-zinc-600 dark:text-zinc-400',
      )}
      aria-label={`${displayedDownloads.toLocaleString()} ${label}${
        weeklyTrendDescription ? `, ${weeklyTrendDescription}` : ''
      }`}
      title={weeklyTrendDescription}
    >
      <span
        className={twMerge(
          showTotals
            ? 'text-left text-zinc-950 dark:text-white'
            : 'relative z-10 text-zinc-950 dark:text-white',
          valueClassName,
        )}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {displayedDownloads.toLocaleString()}
      </span>
      <span
        className={twMerge(
          showTotals ? 'whitespace-nowrap' : 'relative z-10',
          labelClassName,
        )}
      >
        {formattedLabel}
      </span>
    </span>
  ) : null

  if (!showTotals) {
    if (!micro) {
      return null
    }

    return (
      <span
        className={twMerge(
          showTotals ? 'inline-flex flex-col items-start gap-1.5' : undefined,
          className,
        )}
      >
        {micro}
      </span>
    )
  }

  const hasTotalDownloadCount = hasDownloads(totalDownloadCount)
  const hasStarCount = hasDownloads(starCount)
  const weeklyDownloadsRow = micro ?? (
    <span aria-label={label} className={statsRowClassName}>
      <span
        className={twMerge(
          'invisible text-left text-zinc-950 dark:text-white',
          valueClassName,
        )}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        000,000,000
      </span>
      <span className={twMerge('whitespace-nowrap', labelClassName)}>
        {formattedLabel}
      </span>
    </span>
  )

  return (
    <span
      className={twMerge('inline-flex flex-col items-start gap-1.5', className)}
    >
      <span className={statsRowClassName}>
        <span
          className={twMerge(
            'text-left text-zinc-950 dark:text-white',
            !hasTotalDownloadCount ? 'invisible' : undefined,
          )}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hasTotalDownloadCount
            ? formatAbbreviatedNumber(totalDownloadCount)
            : '00.0 Million'}
        </span>
        <span>Total Downloads</span>
      </span>
      {weeklyDownloadsRow}
      <span className={statsRowClassName}>
        <span
          className={twMerge(
            'text-left text-zinc-950 dark:text-white',
            !hasStarCount ? 'invisible' : undefined,
          )}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hasStarCount ? starCount.toLocaleString() : '0'}
        </span>
        <span>GitHub Stars</span>
      </span>
    </span>
  )
}
