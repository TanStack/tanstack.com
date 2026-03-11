import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { intentProject } from '~/libraries/intent'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { Button } from '~/ui'
import {
  intentStatsQueryOptions,
  intentDirectoryQueryOptions,
} from '~/queries/intent'

const library = getLibrary('intent')

export default function IntentLanding() {
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
              from="/$libraryId/$version"
              to="./docs"
              params={{ libraryId: library.id } as never}
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

      <MaintainersSection libraryId="intent" />
      <PartnersSection libraryId="intent" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
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
  const packages = directoryQuery.data?.packages ?? []

  // Don't show section if no data and not loading (registry is empty/not synced yet)
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

        {packages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map((pkg) => (
              <Link
                key={pkg.name}
                to="/intent/registry/$packageName"
                params={{ packageName: pkg.name.replace('/', '__') }}
                className="group flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-4 hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                    {pkg.name}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-sky-600 dark:text-sky-400 tabular-nums">
                    {pkg.skillNames.length}{' '}
                    {pkg.skillNames.length === 1 ? 'skill' : 'skills'}
                  </span>
                </div>
                {pkg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {pkg.description}
                  </p>
                )}
                {pkg.skillNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {pkg.skillNames.slice(0, 7).map((name) => (
                      <span
                        key={name}
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      >
                        {name}
                      </span>
                    ))}
                    {pkg.skillNames.length > 7 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400 dark:text-gray-500">
                        +{pkg.skillNames.length - 7}
                      </span>
                    )}
                  </div>
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
