import NumberFlow from '@number-flow/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { FaCube, FaStar, FaUsers } from 'react-icons/fa'
import { FaDownload } from 'react-icons/fa'
import { BlankErrorBoundary } from './BlankErrorBoundary'
import { Suspense } from 'react'
import { Library } from '~/libraries'
import { ossStatsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'

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
      .join('')
  )
  // TODO don't use locale formatting since it can cause a hydration mismatch
  //.toLocaleString()

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

function isValidMetric(value: number | undefined | null): boolean {
  return (
    value !== undefined &&
    value !== null &&
    !Number.isNaN(value) &&
    value > 0 &&
    Number.isFinite(value)
  )
}

function OssStatsContent({ library }: { library?: Library }) {
  const { data: stats } = useSuspenseQuery(ossStatsQuery({ library }))

  const hasNpmDownloads = isValidMetric(stats.npm?.totalDownloads)
  const hasStarCount = isValidMetric(stats.github?.starCount)
  const hasContributorCount = isValidMetric(stats.github?.contributorCount)
  const hasDependentCount = isValidMetric(stats.github?.dependentCount)

  const visibleMetricsCount = [
    hasNpmDownloads,
    hasStarCount,
    hasContributorCount,
    hasDependentCount,
  ].filter(Boolean).length

  const gridColsClass =
    visibleMetricsCount === 1
      ? 'grid-cols-1'
      : visibleMetricsCount === 2
      ? 'sm:grid-cols-2'
      : visibleMetricsCount === 3
      ? 'sm:grid-cols-2 xl:grid-cols-3'
      : 'sm:grid-cols-2 xl:grid-cols-4'

  return (
    <div>
      <div
        className={`relative p-8 grid grid-cols-1 ${gridColsClass} gap-8 items-center
      justify-center xl:place-items-center bg-white/50 dark:bg-black/40
      dark:shadow-none rounded-xl shadow-xl`}
      >
        {hasNpmDownloads && (
          <a
            href="https://www.npmjs.com/org/tanstack"
            target="_blank"
            rel="noreferrer"
            className="group flex gap-4 items-center"
          >
            <FaDownload className="text-2xl group-hover:text-emerald-500 transition-colors duration-200" />
            <div>
              <div className="text-2xl font-bold opacity-80 relative group-hover:text-emerald-500 transition-colors duration-200">
                <NpmDownloadCounter npmData={stats.npm} />
              </div>
              <div className="text-sm opacity-60 font-medium italic group-hover:text-emerald-500 transition-colors duration-200">
                NPM Downloads
              </div>
            </div>
          </a>
        )}
        {hasStarCount && (
          <a
            href={
              library
                ? `https://github.com/${library.repo}`
                : 'https://github.com/orgs/TanStack/repositories?q=sort:stars'
            }
            target="_blank"
            rel="noreferrer"
            className="group flex gap-4 items-center"
          >
            <FaStar className="group-hover:text-yellow-500 text-2xl transition-colors duration-200" />
            <div>
              <div className="text-2xl font-bold opacity-80 leading-none group-hover:text-yellow-500 transition-colors duration-200 relative">
                <NumberFlow
                  value={stats.github?.starCount}
                  continuous
                  willChange
                />
              </div>
              <div className="text-sm opacity-60 font-medium italic -mt-1 group-hover:text-yellow-500 transition-colors duration-200">
                Stars on Github
              </div>
            </div>
          </a>
        )}
        {hasContributorCount && (
          <div className="flex gap-4 items-center">
            <FaUsers className="text-2xl" />
            <div className="">
              <div className="text-2xl font-bold opacity-80 relative">
                <NumberFlow
                  value={stats.github?.contributorCount}
                  continuous
                  willChange
                />
              </div>
              <div className="text-sm opacity-60 font-medium italic -mt-1">
                Contributors on GitHub
              </div>
            </div>
          </div>
        )}
        {hasDependentCount && (
          <div className="flex gap-4 items-center">
            <FaCube className="text-2xl" />
            <div className="">
              <div className="text-2xl font-bold opacity-80 relative">
                <NumberFlow
                  value={stats.github?.dependentCount}
                  continuous
                  willChange
                />
              </div>
              <div className="text-sm opacity-60 font-medium italic -mt-1">
                Dependents on GitHub
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OssStats({ library }: { library?: Library }) {
  return (
    <Suspense fallback={<></>}>
      <BlankErrorBoundary>
        <OssStatsContent library={library} />
      </BlankErrorBoundary>
    </Suspense>
  )
}
