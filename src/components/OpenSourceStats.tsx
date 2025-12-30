import { useSuspenseQuery } from '@tanstack/react-query'
import { BlankErrorBoundary } from './BlankErrorBoundary'
import { Suspense } from 'react'
import { Library } from '~/libraries'
import { ossStatsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { Box, Download, Star, Users } from 'lucide-react'

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
  const ref = useNpmDownloadCounter(npmData)
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }} />
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

  const npmDownloads = stats.npm?.totalDownloads ?? 0
  const starCount = stats.github?.starCount ?? 0
  const contributorCount = stats.github?.contributorCount ?? 0
  const dependentCount = stats.github?.dependentCount ?? 0

  const hasNpmDownloads = isValidMetric(npmDownloads)
  const hasStarCount = isValidMetric(starCount)
  const hasContributorCount = isValidMetric(contributorCount)
  const hasDependentCount = isValidMetric(dependentCount)

  const hasAnyData =
    hasNpmDownloads || hasStarCount || hasContributorCount || hasDependentCount

  return (
    <div>
      <div
        className="relative p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8 items-center
      justify-center xl:place-items-center bg-white dark:bg-gray-500/10
      rounded-[2rem] border border-gray-500/5 dark:border-gray-500/10
      shadow-md dark:shadow-none"
      >
        {!hasAnyData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 dark:border-pink-500/30 backdrop-blur-sm pointer-events-auto">
              <span className="text-2xl">🚀</span>
              <p className="text-sm font-medium text-pink-600 dark:text-pink-400">
                <span className="font-bold">Fresh out of the oven!</span> This
                library just launched. Be among the first to star, download, and
                contribute!
              </p>
            </div>
          </div>
        )}
        <a
          href="https://www.npmjs.com/org/tanstack"
          target="_blank"
          rel="noreferrer"
          className={`group flex gap-4 items-center ${
            !hasNpmDownloads ? 'opacity-50' : ''
          } ${!hasAnyData ? 'blur-sm' : ''}`}
        >
          <Download className="text-2xl group-hover:text-emerald-500 transition-colors duration-200" />
          <div>
            <div className="text-2xl font-bold opacity-80 relative group-hover:text-emerald-500 transition-colors duration-200">
              {hasNpmDownloads ? (
                <NpmDownloadCounter npmData={stats.npm} />
              ) : (
                <span>0</span>
              )}
            </div>
            <div className="text-sm opacity-60 font-medium italic group-hover:text-emerald-500 transition-colors duration-200">
              NPM Downloads
            </div>
          </div>
        </a>
        <a
          href={
            library
              ? `https://github.com/${library.repo}`
              : 'https://github.com/orgs/TanStack/repositories?q=sort:stars'
          }
          target="_blank"
          rel="noreferrer"
          className={`group flex gap-4 items-center ${
            !hasStarCount ? 'opacity-50' : ''
          } ${!hasAnyData ? 'blur-sm' : ''}`}
        >
          <Star className="group-hover:text-yellow-500 text-2xl transition-colors duration-200" />
          <div>
            <div className="text-2xl font-bold opacity-80 leading-none group-hover:text-yellow-500 transition-colors duration-200 relative">
              {hasStarCount ? starCount.toLocaleString() : '0'}
            </div>
            <div className="text-sm opacity-60 font-medium italic -mt-1 group-hover:text-yellow-500 transition-colors duration-200">
              Stars on Github
            </div>
          </div>
        </a>
        <div
          className={`flex gap-4 items-center ${
            !hasContributorCount ? 'opacity-50' : ''
          } ${!hasAnyData ? 'blur-sm' : ''}`}
        >
          <Users className="text-2xl" />
          <div className="">
            <div className="text-2xl font-bold opacity-80 relative">
              {hasContributorCount ? contributorCount.toLocaleString() : '0'}
            </div>
            <div className="text-sm opacity-60 font-medium italic -mt-1">
              Contributors on GitHub
            </div>
          </div>
        </div>
        <div
          className={`flex gap-4 items-center ${
            !hasDependentCount ? 'opacity-50' : ''
          } ${!hasAnyData ? 'blur-sm' : ''}`}
        >
          <Box className="text-2xl" />
          <div className="">
            <div className="text-2xl font-bold opacity-80 relative">
              {hasDependentCount ? dependentCount.toLocaleString() : '0'}
            </div>
            <div className="text-sm opacity-60 font-medium italic -mt-1">
              Dependents on GitHub
            </div>
          </div>
        </div>
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
