import { useQuery } from '@tanstack/react-query'
import { Library } from '~/libraries'
import { ossStatsQuery } from '~/queries/stats'
import { useNpmDownloadCounter } from '~/hooks/useNpmDownloadCounter'
import { Box, Download, Star, Users } from 'lucide-react'
import { Card } from './Card'

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
  const initialCount = npmData.totalDownloads ?? 0
  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {initialCount.toLocaleString()}
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
  loading,
  placeholder,
  children,
}: {
  loading: boolean
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-grid [&>*]:col-start-1 [&>*]:row-start-1">
      {/* Placeholder — always rendered for sizing, fades out */}
      <span
        className={`inline-block rounded transition-all duration-500 ease-out ${
          loading
            ? 'bg-gray-200 dark:bg-gray-700 animate-pulse opacity-100'
            : 'bg-transparent opacity-0 scale-95'
        }`}
        aria-hidden
      >
        <span className="invisible">{placeholder}</span>
      </span>
      {/* Real value — fades in on top */}
      <span
        className={`transition-all duration-500 ease-out ${
          loading
            ? 'opacity-0 blur-sm scale-105'
            : 'opacity-100 blur-0 scale-100'
        }`}
      >
        {children}
      </span>
    </span>
  )
}

export default function OssStats({ library }: { library?: Library }) {
  const { data: stats, isLoading } = useQuery(ossStatsQuery({ library }))

  const npmDownloads = stats?.npm?.totalDownloads ?? 0
  const starCount = stats?.github?.starCount ?? 0
  const contributorCount = stats?.github?.contributorCount ?? 0
  const dependentCount = stats?.github?.dependentCount ?? 0

  const hasNpmDownloads = !isLoading && isValidMetric(npmDownloads)
  const hasStarCount = !isLoading && isValidMetric(starCount)
  const hasContributorCount = !isLoading && isValidMetric(contributorCount)
  const hasDependentCount = !isLoading && isValidMetric(dependentCount)

  const hasAnyData =
    hasNpmDownloads || hasStarCount || hasContributorCount || hasDependentCount

  const loading = isLoading || !stats

  return (
    <div>
      <Card
        className="relative p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8 items-center
      justify-center xl:place-items-center rounded-[1rem]"
      >
        {!loading && !hasAnyData && (
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
            !loading && !hasNpmDownloads ? 'opacity-50' : ''
          } ${!loading && !hasAnyData ? 'blur-sm' : ''}`}
        >
          <Download className="text-2xl group-hover:text-emerald-500 transition-colors duration-200" />
          <div>
            <div className="text-2xl font-bold opacity-80 relative group-hover:text-emerald-500 transition-colors duration-200">
              <StatValue loading={loading} placeholder="0,000,000,000">
                {hasNpmDownloads && stats ? (
                  <NpmDownloadCounter npmData={stats.npm} />
                ) : (
                  <span>0</span>
                )}
              </StatValue>
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
            !loading && !hasStarCount ? 'opacity-50' : ''
          } ${!loading && !hasAnyData ? 'blur-sm' : ''}`}
        >
          <Star className="group-hover:text-yellow-500 text-2xl transition-colors duration-200" />
          <div>
            <div className="text-2xl font-bold opacity-80 group-hover:text-yellow-500 transition-colors duration-200 relative">
              <StatValue loading={loading} placeholder="000,000">
                {hasStarCount ? starCount.toLocaleString() : '0'}
              </StatValue>
            </div>
            <div className="text-sm opacity-60 font-medium italic -mt-1 group-hover:text-yellow-500 transition-colors duration-200">
              Stars on GitHub
            </div>
          </div>
        </a>
        <div
          className={`flex gap-4 items-center ${
            !loading && !hasContributorCount ? 'opacity-50' : ''
          } ${!loading && !hasAnyData ? 'blur-sm' : ''}`}
        >
          <Users className="text-2xl" />
          <div>
            <div className="text-2xl font-bold opacity-80 relative">
              <StatValue loading={loading} placeholder="0,000">
                {hasContributorCount ? contributorCount.toLocaleString() : '0'}
              </StatValue>
            </div>
            <div className="text-sm opacity-60 font-medium italic -mt-1">
              Contributors on GitHub
            </div>
          </div>
        </div>
        <div
          className={`flex gap-4 items-center ${
            !loading && !hasDependentCount ? 'opacity-50' : ''
          } ${!loading && !hasAnyData ? 'blur-sm' : ''}`}
        >
          <Box className="text-2xl" />
          <div>
            <div className="text-2xl font-bold opacity-80 relative">
              <StatValue loading={loading} placeholder="0,000,000">
                {hasDependentCount ? dependentCount.toLocaleString() : '0'}
              </StatValue>
            </div>
            <div className="text-sm opacity-60 font-medium italic -mt-1">
              Dependents on GitHub
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
