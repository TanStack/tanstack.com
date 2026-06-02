import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'
import type { LibrarySlim } from '~/libraries'
import { recentDownloadsQuery } from '~/queries/stats'
import type { RecentDownloadStats } from '~/utils/stats.types'

type DownloadPeriod = 'daily' | 'monthly' | 'weekly'

type LibraryDownloadsMicroProps = {
  animateIncreaseTrend?: boolean
  className?: string
  label?: string
  labelClassName?: string
  library: LibrarySlim
  period?: DownloadPeriod
  showSparkline?: boolean
  valueClassName?: string
}

const weekInMs = 7 * 24 * 60 * 60 * 1000
const sparklineSize = {
  height: 36,
  width: 244,
}
const sparklineBadgeClassName =
  'relative inline-flex min-h-12 w-64 max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-md px-3 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400'

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

function getSparklinePath({
  height,
  points,
  width,
}: {
  height: number
  points: Array<number>
  width: number
}) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min

  if (!points.length || max <= 0) {
    return undefined
  }

  return points
    .map((value, index) => {
      const x =
        points.length === 1 ? width : (index / (points.length - 1)) * width
      const normalized = range === 0 ? 0.5 : (value - min) / range
      const y = height - normalized * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function getSparklineAreaPath({
  height,
  linePath,
  width,
}: {
  height: number
  linePath: string
  width: number
}) {
  return `${linePath} L${width.toFixed(2)},${height.toFixed(2)} L0,${height.toFixed(2)} Z`
}

function DownloadSparkline({
  stats,
}: {
  stats: RecentDownloadStats | undefined
}) {
  const gradientId = React.useId().replaceAll(':', '')
  const paths = React.useMemo(() => {
    const points = stats?.sparklineDownloads.map((point) => point.downloads)

    if (!points || points.filter((point) => point > 0).length < 2) {
      return undefined
    }

    const linePath = getSparklinePath({
      points,
      width: sparklineSize.width,
      height: sparklineSize.height,
    })

    if (!linePath) {
      return undefined
    }

    return {
      areaPath: getSparklineAreaPath({
        linePath,
        width: sparklineSize.width,
        height: sparklineSize.height,
      }),
      linePath,
    }
  }, [stats])

  if (!paths) {
    return null
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] overflow-visible"
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${sparklineSize.width} ${sparklineSize.height}`}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          x2="0"
          y1="0"
          y2={sparklineSize.height}
          gradientUnits="userSpaceOnUse"
        >
          <stop className="[stop-color:#0891b2] [stop-opacity:0.14] dark:[stop-color:#67e8f9] dark:[stop-opacity:0.16]" />
          <stop
            className="[stop-color:#0891b2] [stop-opacity:0.05] dark:[stop-color:#67e8f9] dark:[stop-opacity:0.06]"
            offset="65%"
          />
          <stop
            className="[stop-color:#0891b2] [stop-opacity:0] dark:[stop-color:#67e8f9] dark:[stop-opacity:0]"
            offset="100%"
          />
        </linearGradient>
      </defs>
      <path d={paths.areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={paths.linePath}
        className="stroke-cyan-600 dark:stroke-cyan-300"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  )
}

export function LibraryDownloadsMicro({
  animateIncreaseTrend = false,
  className,
  label = 'monthly npm downloads',
  labelClassName,
  library,
  period = 'monthly',
  showSparkline = false,
  valueClassName,
}: LibraryDownloadsMicroProps) {
  const { data: stats } = useQuery(recentDownloadsQuery({ library }))
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

  if (!hasNpmDownloads) {
    if (showSparkline) {
      return (
        <span
          aria-hidden="true"
          className={twMerge(sparklineBadgeClassName, 'invisible', className)}
        >
          <span
            className="relative z-10 min-w-[11ch] text-right text-zinc-950 dark:text-white"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            000,000,000
          </span>
          <span
            className={twMerge(
              'relative z-10 whitespace-nowrap',
              labelClassName,
            )}
          >
            {label}
          </span>
        </span>
      )
    }

    return null
  }

  return (
    <span
      className={twMerge(
        showSparkline
          ? sparklineBadgeClassName
          : 'inline-flex items-center gap-1.5 text-sm font-bold text-zinc-600 dark:text-zinc-400',
        className,
      )}
      aria-label={`${displayedDownloads.toLocaleString()} ${label}${
        weeklyTrendDescription ? `, ${weeklyTrendDescription}` : ''
      }`}
      title={weeklyTrendDescription}
    >
      {showSparkline ? <DownloadSparkline stats={stats} /> : null}
      <span
        className={twMerge(
          showSparkline
            ? 'relative z-10 min-w-[11ch] text-right text-zinc-950 dark:text-white'
            : 'relative z-10 text-zinc-950 dark:text-white',
          valueClassName,
        )}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {displayedDownloads.toLocaleString()}
      </span>
      <span
        className={twMerge(
          showSparkline ? 'relative z-10 whitespace-nowrap' : 'relative z-10',
          labelClassName,
        )}
      >
        {label}
      </span>
    </span>
  )
}
