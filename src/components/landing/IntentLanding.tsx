import * as React from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { intentProject } from '~/libraries/intent'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { Button } from '~/ui'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import {
  intentStatsQueryOptions,
  intentDirectoryQueryOptions,
  intentSkillHistoryQueryOptions,
} from '~/queries/intent'
import { SkillSparkline } from '~/components/intent/SkillSparkline'
import type { SkillHistoryEntry } from '~/utils/intent.functions'

const library = getLibrary('intent')

export default function IntentLanding() {
  const { version } = useParams({ strict: false })

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={intentProject}
        actions={
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              as={Link}
              to="/intent/registry"
              className="bg-transparent border-sky-500 dark:border-sky-600 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
            >
              View Registry
            </Button>
            <Button
              as={Link}
              to="/$libraryId/$version/docs"
              params={{ libraryId: library.id, version } as never}
              className="bg-sky-500 border-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:border-sky-600 text-white"
            >
              Get Started
            </Button>
          </div>
        }
      />

      <LibraryStatsSection library={library} />

      <IntentRegistryPreview />

      <LibraryFeatureHighlights
        featureHighlights={intentProject.featureHighlights}
      />

      <LazyLandingCommunitySection
        libraryId="intent"
        libraryName="TanStack Intent"
        showShowcases={false}
      />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-sky-500 border-sky-500 hover:bg-sky-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}

function IntentRegistryPreview() {
  const statsQuery = useQuery(intentStatsQueryOptions())
  const directoryQuery = useQuery(
    intentDirectoryQueryOptions({ sort: 'downloads', pageSize: 9 }),
  )

  const stats = statsQuery.data
  const packages = directoryQuery.data?.packages

  const packageNames = React.useMemo(
    () => (packages ?? []).map((p) => p.name),
    [packages],
  )
  const skillHistoryQuery = useQuery(
    intentSkillHistoryQueryOptions(packageNames),
  )
  const skillHistory = React.useMemo(
    () => skillHistoryQuery.data ?? {},
    [skillHistoryQuery.data],
  )
  const maxSlots = React.useMemo(
    () => Math.max(...Object.values(skillHistory).map((h) => h.length), 2),
    [skillHistory],
  )

  const navigate = useNavigate()

  if (!statsQuery.isLoading && (stats?.packageCount ?? 0) === 0) return null

  return (
    <div className="py-12 lg:py-16 px-4">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Skills Registry
            </h2>
            <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">
              {stats ? (
                <>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {stats.packageCount}
                  </span>{' '}
                  {stats.packageCount === 1 ? 'package' : 'packages'},{' '}
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {stats.skillCount}
                  </span>{' '}
                  {stats.skillCount === 1 ? 'skill' : 'skills'} indexed
                </>
              ) : (
                'Loading...'
              )}
            </p>
          </div>
          <Link
            to="/intent/registry"
            className="shrink-0 text-sm text-sky-600 dark:text-sky-400 hover:underline font-medium"
          >
            Browse all
          </Link>
        </div>

        {packages && packages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map((pkg) => (
              <Link
                key={pkg.name}
                to="/intent/registry/$packageName"
                params={{ packageName: pkg.name.replace('/', '__') }}
                className="group flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                    {pkg.name}
                  </span>
                  <div className="shrink-0 w-20">
                    {skillHistory[pkg.name] &&
                    skillHistory[pkg.name].length > 0 ? (
                      <SkillSparkline
                        history={skillHistory[pkg.name]}
                        height={24}
                        maxSlots={maxSlots}
                        onVersionClick={(entry: SkillHistoryEntry) => {
                          navigate({
                            to: '/intent/registry/$packageName',
                            params: {
                              packageName: pkg.name.replace('/', '__'),
                            },
                            search: { version: entry.version },
                          })
                        }}
                      />
                    ) : null}
                  </div>
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                  <span className="shrink-0 text-xs font-medium text-sky-600 dark:text-sky-400 tabular-nums">
                    {pkg.skillNames.length}{' '}
                    {pkg.skillNames.length === 1 ? 'skill' : 'skills'}
                  </span>
                  {pkg.monthlyDownloads > 0 && (
                    <span className="tabular-nums">
                      {pkg.monthlyDownloads >= 1_000_000
                        ? `${(pkg.monthlyDownloads / 1_000_000).toFixed(1)}M`
                        : pkg.monthlyDownloads >= 1_000
                          ? `${Math.floor(pkg.monthlyDownloads / 1_000)}K`
                          : pkg.monthlyDownloads}
                      /mo
                    </span>
                  )}
                  <span className="font-mono">v{pkg.latestVersion}</span>
                  {pkg.frameworks.length > 0 && (
                    <span>{pkg.frameworks.slice(0, 2).join(', ')}</span>
                  )}
                </div>
                {pkg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {pkg.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : directoryQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 animate-pulse"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
