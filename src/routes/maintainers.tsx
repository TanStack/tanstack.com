import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { CompactMaintainerCard } from '~/components/MaintainerCard'
import {
  MaintainersDirectoryFilters,
  maintainersDirectorySearchSchema,
} from '~/components/MaintainersDirectoryFilters'
import { seo } from '~/utils/seo'
import {
  allMaintainers,
  Maintainer,
  getPersonsMaintainerOf,
  getMaintainersForLibraries,
  getRolePriorityForFilteredLibraries,
  getIsCoreMaintainerForFilteredLibraries,
  getRoleForFilteredLibraries,
} from '~/libraries/maintainers'
import { libraries } from '~/libraries'

export const Route = createFileRoute('/maintainers')({
  component: RouteComponent,
  validateSearch: maintainersDirectorySearchSchema,
  staticData: {
    includeSearchInCanonical: true,
  },
  head: () => ({
    meta: seo({
      title: 'Maintainers | TanStack',
      description:
        'Meet the core maintainers and contributors who make TanStack possible',
      keywords: 'tanstack,maintainers,contributors,open source,developers',
    }),
  }),
})

function MaintainerGrid({
  maintainers,
  title,
}: {
  maintainers: Maintainer[]
  title: string
}) {
  return (
    <div>
      {title && <h3 className="mb-4 text-2xl font-semibold">{title}</h3>}
      <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {maintainers.map((maintainer, index) => (
          <div
            key={maintainer.github}
            className="transition-all duration-300 ease-out transform"
            style={{
              animationDelay: `${index * 50}ms`,
              animation: 'fadeInUp 0.5s ease-out forwards',
            }}
          >
            <CompactMaintainerCard maintainer={maintainer} />
          </div>
        ))}
      </div>
    </div>
  )
}

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const updateFilters = (updates: Partial<typeof search>) => {
    navigate({
      search: (previous) => ({ ...previous, ...updates }),
      replace: true,
    })
  }

  const filteredMaintainers = React.useMemo(() => {
    const filtered = getMaintainersForLibraries(search.libraries).filter(
      (maintainer) =>
        (!search.frameworks?.length ||
          search.frameworks.some((framework) =>
            maintainer.frameworkExpertise?.includes(framework),
          )) &&
        (!search.specialties?.length ||
          maintainer.specialties?.some((specialty) =>
            search.specialties?.includes(specialty.toLowerCase()),
          )),
    )

    // Sort maintainers
    filtered.sort((a, b) => {
      // Get original indices to preserve order
      const aIndex = allMaintainers.findIndex((m) => m.github === a.github)
      const bIndex = allMaintainers.findIndex((m) => m.github === b.github)

      switch (search.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'role':
          // Sort by role priority within filtered libraries, then core status, then original order
          const aPriority = getRolePriorityForFilteredLibraries(
            a,
            search.libraries,
          )
          const bPriority = getRolePriorityForFilteredLibraries(
            b,
            search.libraries,
          )

          if (aPriority !== bPriority) {
            return bPriority - aPriority // Higher priority first
          }

          // Same role priority - use core maintainer status for filtered libraries
          const aIsCore = getIsCoreMaintainerForFilteredLibraries(
            a,
            search.libraries,
          )
          const bIsCore = getIsCoreMaintainerForFilteredLibraries(
            b,
            search.libraries,
          )

          if (aIsCore && !bIsCore) return -1
          if (!aIsCore && bIsCore) return 1

          return aIndex - bIndex
        case 'contributions':
          // Sort by number of libraries they're involved with
          const aLibs =
            (a.creatorOf?.length || 0) +
            (a.maintainerOf?.length || 0) +
            (a.contributorOf?.length || 0)
          const bLibs =
            (b.creatorOf?.length || 0) +
            (b.maintainerOf?.length || 0) +
            (b.contributorOf?.length || 0)
          return bLibs - aLibs || aIndex - bIndex
        case 'none':
          // No sorting: Preserve original order from allMaintainers array
          return aIndex - bIndex
        default:
          // Default: Preserve original order from allMaintainers array
          return aIndex - bIndex
      }
    })

    return filtered
  }, [search.libraries, search.frameworks, search.specialties, search.sortBy])

  // Group maintainers based on groupBy setting
  const groupedMaintainers = React.useMemo(() => {
    switch (search.groupBy) {
      case 'core':
        const coreMaintainers = filteredMaintainers.filter(
          (m) => m.isCoreMaintainer,
        )
        const regularMaintainers = filteredMaintainers.filter(
          (m) =>
            !m.isCoreMaintainer &&
            ((m.creatorOf && m.creatorOf.length > 0) ||
              (m.maintainerOf && m.maintainerOf.length > 0)),
        )
        const regularContributors = filteredMaintainers.filter(
          (m) =>
            !m.isCoreMaintainer &&
            (!m.creatorOf || m.creatorOf.length === 0) &&
            (!m.maintainerOf || m.maintainerOf.length === 0),
        )

        // Sort by original order within each group
        const sortByOriginalOrder = (group: Maintainer[]) => {
          return group.sort((a, b) => {
            const aIndex = allMaintainers.findIndex(
              (m) => m.github === a.github,
            )
            const bIndex = allMaintainers.findIndex(
              (m) => m.github === b.github,
            )
            return aIndex - bIndex
          })
        }

        return [
          {
            title: 'Core Maintainers',
            maintainers: sortByOriginalOrder(coreMaintainers),
          },
          {
            title: 'Maintainers',
            maintainers: sortByOriginalOrder(regularMaintainers),
          },
          {
            title: 'Contributors',
            maintainers: sortByOriginalOrder(regularContributors),
          },
        ].filter((group) => group.maintainers.length > 0)

      case 'library':
        const byLibrary = new Map<string, Maintainer[]>()
        filteredMaintainers.forEach((maintainer) => {
          // Get all libraries this person is involved with (maintainer, creator, contributor)
          const maintainerLibs = getPersonsMaintainerOf(maintainer)
          const contributorLibs =
            maintainer.contributorOf
              ?.map((id) => libraries.find((lib) => lib.id === id))
              .filter(Boolean) || []
          const allLibs = [...maintainerLibs, ...contributorLibs]

          if (allLibs.length === 0) {
            // Only put in "Other" if they have no library associations at all
            const existing = byLibrary.get('Other') || []
            byLibrary.set('Other', [...existing, maintainer])
          } else {
            allLibs.forEach((lib) => {
              if (lib) {
                const existing = byLibrary.get(lib.name) || []
                byLibrary.set(lib.name, [...existing, maintainer])
              }
            })
          }
        })

        // Sort maintainers within each library group: creators first, then maintainers, then contributors
        return Array.from(byLibrary.entries()).map(([title, maintainers]) => {
          const uniqueMaintainers = [...new Set(maintainers)]
          const sortedMaintainers = uniqueMaintainers.sort((a, b) => {
            const aIndex = allMaintainers.findIndex(
              (m) => m.github === a.github,
            )
            const bIndex = allMaintainers.findIndex(
              (m) => m.github === b.github,
            )

            // Get library ID for this group
            const lib = libraries.find((l) => l.name === title)
            if (!lib) return aIndex - bIndex

            // Sort by role hierarchy within this library
            const aIsCreator = a.creatorOf?.includes(lib.id)
            const bIsCreator = b.creatorOf?.includes(lib.id)
            const aIsMaintainer = a.maintainerOf?.includes(lib.id)
            const bIsMaintainer = b.maintainerOf?.includes(lib.id)

            if (aIsCreator && !bIsCreator) return -1
            if (!aIsCreator && bIsCreator) return 1
            if (aIsMaintainer && !bIsMaintainer) return -1
            if (!aIsMaintainer && bIsMaintainer) return 1

            // Same role level - use original order
            return aIndex - bIndex
          })

          return {
            title,
            maintainers: sortedMaintainers,
          }
        })

      case 'role':
        const creators = filteredMaintainers.filter(
          (m) => getRoleForFilteredLibraries(m, search.libraries) === 'creator',
        )
        const libraryMaintainers = filteredMaintainers.filter(
          (m) =>
            getRoleForFilteredLibraries(m, search.libraries) === 'maintainer',
        )
        const libraryContributors = filteredMaintainers.filter(
          (m) =>
            getRoleForFilteredLibraries(m, search.libraries) === 'contributor',
        )

        // Sort each role group: core maintainers first, then by original order
        const sortRoleGroup = (group: Maintainer[]) => {
          return group.sort((a, b) => {
            const aIndex = allMaintainers.findIndex(
              (m) => m.github === a.github,
            )
            const bIndex = allMaintainers.findIndex(
              (m) => m.github === b.github,
            )

            // Core maintainers first within each role
            if (a.isCoreMaintainer && !b.isCoreMaintainer) return -1
            if (!a.isCoreMaintainer && b.isCoreMaintainer) return 1

            // Then by original order
            return aIndex - bIndex
          })
        }

        return [
          { title: 'Creators', maintainers: sortRoleGroup(creators) },
          {
            title: 'Maintainers',
            maintainers: sortRoleGroup(libraryMaintainers),
          },
          {
            title: 'Contributors',
            maintainers: sortRoleGroup(libraryContributors),
          },
        ].filter((group) => group.maintainers.length > 0)

      default:
        return [{ title: '', maintainers: filteredMaintainers }]
    }
  }, [filteredMaintainers, search.groupBy, search.libraries])

  const hasResults = filteredMaintainers.length > 0
  const hasFilters =
    !!search.libraries?.length ||
    !!search.frameworks?.length ||
    !!search.specialties?.length ||
    search.groupBy !== 'none' ||
    search.sortBy !== 'none'

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="@container isolate flex min-h-screen max-w-full flex-col pt-4 md:pt-8">
        <div className="mx-auto flex w-[calc(100%-2rem)] max-w-4xl flex-1 flex-col gap-6 md:w-[calc(100%-4rem)] md:gap-8">
          <header className="-mb-2 rounded-lg border border-border-default bg-background-elevated p-4 md:-mb-4">
            <h1 className="text-3xl font-black">Maintainers & Contributors</h1>
            <p className="text-lg mt-3 md:mt-4 text-gray-600 dark:text-gray-400">
              Meet the amazing developers who make TanStack possible through
              their contributions, maintenance, and dedication to open source
            </p>
          </header>

          <MaintainersDirectoryFilters
            search={search}
            onChange={updateFilters}
            clearAll={
              hasFilters
                ? () => navigate({ search: {}, replace: true })
                : undefined
            }
          />

          {hasResults ? (
            <div>
              {hasFilters && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                  Showing {filteredMaintainers.length} maintainer
                  {filteredMaintainers.length === 1 ? '' : 's'}
                </p>
              )}

              {groupedMaintainers.map((group) => (
                <MaintainerGrid
                  key={group.title || 'all'}
                  maintainers={group.maintainers}
                  title={group.title}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400">
              <div>
                <p className="text-lg mb-4">
                  No maintainers found for the selected filters.
                </p>
                <button
                  onClick={() => navigate({ search: {}, replace: true })}
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                >
                  View All Maintainers
                </button>
              </div>
            </div>
          )}

          <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">Want to Contribute?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
              TanStack is always welcoming new contributors! Check out our
              repositories and join our vibrant community.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/tanstack"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                View on GitHub
              </a>
              <a
                href="https://discord.com/invite/WrRKjPJ"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Join Discord
              </a>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center max-w-2xl mx-auto py-8 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="font-medium">Note:</span> This list showcases
              some of our most active maintainers and contributors who have been
              with or around TanStack for an extended period and have agreed to
              be featured here. However, this represents only a fraction of the
              incredible community that makes TanStack possible. Over the years,{' '}
              <span className="font-medium">thousands of developers</span> have
              contributed code, documentation, bug reports, and ideas that have
              shaped these libraries. We're deeply grateful to every single
              contributor, whether listed here or not.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
