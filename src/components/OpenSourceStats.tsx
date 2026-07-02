import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { libraries, type Library } from '~/libraries'
import { ossStatsQuery, recentDownloadsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { Download, Star, TrendUp } from '@phosphor-icons/react'

const tanStackNpmStatsLibrary = {
  id: 'tanstack',
  npmPackageNames: [
    ...new Set(libraries.flatMap((library) => library.npmPackageNames ?? [])),
  ],
}

function formatBillions(value: number) {
  return `${(value / 1_000_000_000).toFixed(2)} Billion`
}

function WeeklyDownloadCounter({
  ratePerDay,
  weeklyDownloads,
}: {
  ratePerDay?: number
  weeklyDownloads: number
}) {
  const startedAtRef = React.useRef(Date.now())
  const ref = useNpmDownloadCounter({
    totalDownloads: weeklyDownloads,
    ratePerDay,
    updatedAt: startedAtRef.current,
  })

  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {weeklyDownloads.toLocaleString()}
    </span>
  )
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

function StatValue({
  placeholder,
  children,
}: {
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-grid [&>*]:col-start-1 [&>*]:row-start-1">
      <span className="invisible" aria-hidden>
        {placeholder}
      </span>
      <span>{children}</span>
    </span>
  )
}

function HomeStatLink({
  children,
  className,
  gradientClassName,
  href,
}: {
  children: React.ReactNode
  className: string
  gradientClassName: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`group min-w-0 rounded-r-md border-l-2 px-4 py-2 text-left transition-opacity ${className} ${gradientClassName}`}
    >
      {children}
    </a>
  )
}

export default function OssStats({ library }: { library?: Library }) {
  const { data: stats, isLoading } = useQuery(ossStatsQuery({ library }))
  const { data: recentDownloads, isLoading: isLoadingRecentDownloads } =
    useQuery({
      ...recentDownloadsQuery({
        library: library ?? tanStackNpmStatsLibrary,
      }),
      enabled: Boolean(library),
    })

  const npmDownloads = stats?.npm?.totalDownloads ?? 0
  const starCount = stats?.github?.starCount ?? 0
  const cachedWeeklyDownloads = Math.round((stats?.npm?.ratePerDay ?? 0) * 7)
  const weeklyDownloads = library
    ? (recentDownloads?.weeklyDownloads ?? 0)
    : cachedWeeklyDownloads
  const weeklyRatePerDay = library ? undefined : stats?.npm?.ratePerDay

  const hasNpmDownloads = !isLoading && isValidMetric(npmDownloads)
  const hasStarCount = !isLoading && isValidMetric(starCount)
  const hasWeeklyDownloads =
    !(library ? isLoadingRecentDownloads : isLoading) &&
    isValidMetric(weeklyDownloads)

  const hasAnyData = hasNpmDownloads || hasWeeklyDownloads || hasStarCount

  const loading = isLoading || !stats
  const weeklyLoading = library
    ? isLoadingRecentDownloads || !recentDownloads
    : loading

  if (!loading && !weeklyLoading && !hasAnyData) {
    return null
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      {loading || hasNpmDownloads ? (
        <HomeStatLink
          href="https://www.npmjs.com/org/tanstack"
          className="border-emerald-500 hover:text-emerald-500"
          gradientClassName="bg-linear-to-r from-transparent to-emerald-500/5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Download className="mt-1 size-5 shrink-0 transition-colors duration-200" />
            <div className="min-w-0">
              <div className="relative text-2xl font-black leading-none tracking-tight transition-colors duration-200">
                <StatValue placeholder="00.00 Billion">
                  {hasNpmDownloads && stats
                    ? formatBillions(stats.npm.totalDownloads)
                    : null}
                </StatValue>
              </div>
              <div className="mt-1 text-sm font-semibold italic text-zinc-500 transition-colors duration-200 dark:text-zinc-400">
                NPM Downloads
              </div>
            </div>
          </div>
        </HomeStatLink>
      ) : null}

      {weeklyLoading || hasWeeklyDownloads ? (
        <HomeStatLink
          href="https://www.npmjs.com/org/tanstack"
          className="border-cyan-500 hover:text-cyan-500"
          gradientClassName="bg-linear-to-r from-transparent to-cyan-500/5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <TrendUp className="mt-1 size-5 shrink-0 transition-colors duration-200" />
            <div className="min-w-0">
              <div className="relative text-2xl font-black leading-none tracking-tight transition-colors duration-200">
                <StatValue placeholder="00,000,000">
                  {hasWeeklyDownloads ? (
                    <WeeklyDownloadCounter
                      ratePerDay={weeklyRatePerDay}
                      weeklyDownloads={weeklyDownloads}
                    />
                  ) : null}
                </StatValue>
              </div>
              <div className="mt-1 text-sm font-semibold italic text-zinc-500 transition-colors duration-200 dark:text-zinc-400">
                Weekly Downloads
              </div>
            </div>
          </div>
        </HomeStatLink>
      ) : null}

      {loading || hasStarCount ? (
        <HomeStatLink
          href={
            library
              ? `https://github.com/${library.repo}`
              : 'https://github.com/orgs/TanStack/repositories?q=sort:stars'
          }
          className="border-yellow-500 hover:text-yellow-500"
          gradientClassName="bg-linear-to-r from-transparent to-yellow-500/5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Star className="mt-1 size-5 shrink-0 transition-colors duration-200" />
            <div className="min-w-0">
              <div className="relative text-2xl font-black leading-none tracking-tight transition-colors duration-200">
                <StatValue placeholder="000,000">
                  {hasStarCount ? starCount.toLocaleString() : null}
                </StatValue>
              </div>
              <div className="mt-1 text-sm font-semibold italic text-zinc-500 transition-colors duration-200 dark:text-zinc-400">
                GitHub Stars
              </div>
            </div>
          </div>
        </HomeStatLink>
      ) : null}
    </div>
  )
}
