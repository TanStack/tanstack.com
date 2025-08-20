import { z } from 'zod'
import { useState } from 'react'
import * as React from 'react'
import {
  MdClose,
  MdFilterList,
  MdViewList,
  MdViewModule,
  MdFormatListBulleted,
} from 'react-icons/md'
import { Footer } from '~/components/Footer'
import {
  MaintainerCard,
  CompactMaintainerCard,
  MaintainerRowCard,
} from '~/components/MaintainerCard'
import { seo } from '~/utils/seo'
import {
  allMaintainers,
  Maintainer,
  getPersonsMaintainerOf,
  getRolePriorityForFilteredLibraries,
  getIsCoreMaintainerForFilteredLibraries,
  getRoleForFilteredLibraries,
} from '~/libraries/maintainers'
import { Library, libraries } from '~/libraries'
// import { fetchAllMaintainerStats } from '~/utils/docs'

const librarySchema = z.enum([
  'start',
  'router',
  'query',
  'table',
  'form',
  'virtual',
  'ranger',
  'store',
  'pacer',
  'db',
  'config',
  'react-charts',
  'create-tsrouter-app',
  'devtools',
])

const viewModeSchema = z.enum(['compact', 'full', 'row'])
const groupBySchema = z.enum(['none', 'core', 'library', 'role'])
const sortBySchema = z.enum(['none', 'name', 'role', 'contributions'])

export const Route = createFileRoute({
  component: RouteComponent,
  validateSearch: z.object({
    libraries: z.array(librarySchema).optional().catch(undefined),
    viewMode: viewModeSchema.optional().default('compact').catch('compact'),
    groupBy: groupBySchema.optional().default('none').catch('none'),
    sortBy: sortBySchema.optional().default('none').catch('none'),
  }),
  head: () => ({
    meta: seo({
      title: 'Maintainers | TanStack',
      description:
        'Meet the core maintainers and contributors who make TanStack possible',
      keywords: 'tanstack,maintainers,contributors,open source,developers',
    }),
  }),
  // loader: async ({ context: { queryClient } }) => {
  //   try {
  //     // Fetch GitHub stats for all maintainers
  //     const stats = await queryClient.ensureQueryData({
  //       queryKey: ['maintainerStats'],
  //       queryFn: () => fetchAllMaintainerStats(),
  //       staleTime: 1000 * 60 * 30, // 30 minutes
  //     })

  //     return {
  //       stats,
  //     }
  //   } catch (error) {
  //     console.error('Error loading maintainer stats:', error)
  //     // Return empty stats array if there's an error
  //     return {
  //       stats: [],
  //     }
  //   }
  // },
})

interface FilterProps {
  selectedLibraries: Library['id'][] | undefined
  viewMode: 'compact' | 'full' | 'row'
  groupBy: 'none' | 'core' | 'library' | 'role'
  sortBy: 'none' | 'name' | 'role' | 'contributions'
  onLibrariesChange: (libraries: Library['id'][] | undefined) => void
  onViewModeChange: (mode: 'compact' | 'full' | 'row') => void
  onGroupByChange: (groupBy: 'none' | 'core' | 'library' | 'role') => void
  onSortByChange: (sortBy: 'none' | 'name' | 'role' | 'contributions') => void
  onClearAll: () => void
}

function MaintainersFilter({
  selectedLibraries,
  viewMode,
  groupBy,
  sortBy,
  onLibrariesChange,
  onViewModeChange,
  onGroupByChange,
  onSortByChange,
  onClearAll,
}: FilterProps) {
  const [isOpen, setIsOpen] = useState(false)

  const availableLibraries = libraries.map((lib) => ({
    id: lib.id,
    name: lib.name,
    bgStyle: lib.bgStyle,
  }))

  const toggleLibrary = (libraryId: Library['id']) => {
    if (!selectedLibraries) {
      onLibrariesChange([libraryId])
      return
    }

    if (selectedLibraries.includes(libraryId)) {
      const newLibraries = selectedLibraries.filter((id) => id !== libraryId)
      onLibrariesChange(newLibraries.length > 0 ? newLibraries : undefined)
    } else {
      onLibrariesChange([...selectedLibraries, libraryId])
    }
  }

  const clearFilters = () => {
    onClearAll()
    setIsOpen(false)
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('[data-filter-dropdown]')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  const hasFilters =
    (selectedLibraries && selectedLibraries.length > 0) ||
    groupBy !== 'none' ||
    sortBy !== 'none'
  const filterCount =
    (selectedLibraries?.length || 0) +
    (groupBy !== 'none' ? 1 : 0) +
    (sortBy !== 'none' ? 1 : 0)

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <button
            onClick={() => onViewModeChange('compact')}
            className={`p-2 rounded-l-lg transition-colors ${
              viewMode === 'compact'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            title="Compact cards"
          >
            <MdViewList className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewModeChange('full')}
            className={`p-2 transition-colors ${
              viewMode === 'full'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            title="Full cards"
          >
            <MdViewModule className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewModeChange('row')}
            className={`p-2 rounded-r-lg transition-colors ${
              viewMode === 'row'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            title="Row cards"
          >
            <MdFormatListBulleted className="w-5 h-5" />
          </button>
        </div>

        {/* Filter dropdown trigger */}
        <div className="relative" data-filter-dropdown>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <MdFilterList className="w-4 h-4" />
            Filter & Sort
            {hasFilters && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs">
                {filterCount}
              </span>
            )}
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Filter & Sort Options
                  </span>
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Group By */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Group By
                  </label>
                  <select
                    value={groupBy}
                    onChange={(e) =>
                      onGroupByChange(e.target.value as typeof groupBy)
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
                  >
                    <option value="none">No Grouping</option>
                    <option value="core">
                      Core vs Maintainers vs Contributors
                    </option>
                    <option value="library">By Library</option>
                    <option value="role">By Role</option>
                  </select>
                </div>

                {/* Sort By */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      onSortByChange(e.target.value as typeof sortBy)
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100"
                  >
                    <option value="none">No Sorting</option>
                    <option value="name">Name</option>
                    <option value="role">Role/Level</option>
                    <option value="contributions">Contributions</option>
                  </select>
                </div>

                {/* Library filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter by Libraries
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {availableLibraries.map((library) => {
                      const isSelected =
                        selectedLibraries?.includes(library.id) || false

                      const bgStyle = library.bgStyle ?? 'bg-gray-500'

                      return (
                        <button
                          key={library.id}
                          onClick={() => toggleLibrary(library.id)}
                          className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            isSelected
                              ? `${bgStyle} text-white`
                              : `${bgStyle}/30 text-green-900 dark:text-green-200 hover:${bgStyle}/40`
                          }`}
                        >
                          {library.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current filter chips */}
        <div className="flex flex-wrap gap-2">
          {selectedLibraries?.map((libraryId) => {
            const library = availableLibraries.find(
              (lib) => lib.id === libraryId
            )
            const bgStyle = library?.bgStyle ?? 'bg-gray-500'

            return (
              <span
                key={libraryId}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-green-900 dark:text-green-200 ${bgStyle}/40`}
              >
                {library?.name || libraryId}
                <button
                  onClick={() => toggleLibrary(libraryId)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5 transition-colors"
                >
                  <MdClose className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MaintainerGrid({
  maintainers,
  viewMode,
  title,
  stats,
}: {
  maintainers: Maintainer[]
  viewMode: 'compact' | 'full' | 'row'
  title?: string
  stats?: Array<{
    username: string
    totalCommits: number
    totalPullRequests: number
    totalIssues: number
    totalReviews: number
  }>
}) {
  return (
    <div>
      {title && <h3 className="text-2xl font-semibold mb-4">{title}</h3>}
      <div
        className={`transition-all duration-300 ${
          viewMode === 'compact'
            ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6'
            : viewMode === 'row'
            ? 'flex flex-col gap-4'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
        }`}
      >
        {maintainers.map((maintainer, index) => (
          <div
            key={maintainer.github}
            className="transition-all duration-300 ease-out transform"
            style={{
              animationDelay: `${index * 50}ms`,
              animation: 'fadeInUp 0.5s ease-out forwards',
            }}
          >
            {viewMode === 'compact' ? (
              <CompactMaintainerCard maintainer={maintainer} />
            ) : viewMode === 'row' ? (
              <MaintainerRowCard
                maintainer={maintainer}
                stats={stats?.find((s) => s.username === maintainer.github)}
              />
            ) : (
              <MaintainerCard maintainer={maintainer} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // const loaderData = Route.useLoaderData()
  // const stats = loaderData?.stats || []
  const stats: any[] = [] // Empty array since stats are commented out

  const updateFilters = (updates: {
    libraries?: Library['id'][] | undefined
    viewMode?: 'compact' | 'full' | 'row'
    groupBy?: 'none' | 'core' | 'library' | 'role'
    sortBy?: 'none' | 'name' | 'role' | 'contributions'
  }) => {
    navigate({
      search: {
        ...search,
        ...updates,
      },
      replace: true,
    })
  }

  // Filter maintainers based on selected criteria
  const filteredMaintainers = React.useMemo(() => {
    let filtered = [...allMaintainers]

    // Filter by libraries
    if (search.libraries && search.libraries.length > 0) {
      filtered = filtered.filter((maintainer) => {
        const maintainerLibraries = getPersonsMaintainerOf(maintainer)
        return (
          maintainerLibraries.some((lib) =>
            search.libraries!.includes(lib.id as Library['id'])
          ) ||
          maintainer.creatorOf?.some((lib) =>
            search.libraries!.includes(lib)
          ) ||
          maintainer.maintainerOf?.some((lib) =>
            search.libraries!.includes(lib)
          ) ||
          maintainer.contributorOf?.some((lib) =>
            search.libraries!.includes(lib)
          ) ||
          maintainer.consultantOf?.some((lib) =>
            search.libraries!.includes(lib)
          )
        )
      })
    }

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
            search.libraries
          )
          const bPriority = getRolePriorityForFilteredLibraries(
            b,
            search.libraries
          )

          if (aPriority !== bPriority) {
            return bPriority - aPriority // Higher priority first
          }

          // Same role priority - use core maintainer status for filtered libraries
          const aIsCore = getIsCoreMaintainerForFilteredLibraries(
            a,
            search.libraries
          )
          const bIsCore = getIsCoreMaintainerForFilteredLibraries(
            b,
            search.libraries
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
  }, [search.libraries, search.sortBy])

  // Group maintainers based on groupBy setting
  const groupedMaintainers = React.useMemo(() => {
    switch (search.groupBy) {
      case 'core':
        const coreMaintainers = filteredMaintainers.filter(
          (m) => m.isCoreMaintainer
        )
        const regularMaintainers = filteredMaintainers.filter(
          (m) =>
            !m.isCoreMaintainer &&
            ((m.creatorOf && m.creatorOf.length > 0) ||
              (m.maintainerOf && m.maintainerOf.length > 0))
        )
        const regularContributors = filteredMaintainers.filter(
          (m) =>
            !m.isCoreMaintainer &&
            (!m.creatorOf || m.creatorOf.length === 0) &&
            (!m.maintainerOf || m.maintainerOf.length === 0)
        )

        // Sort by original order within each group
        const sortByOriginalOrder = (group: Maintainer[]) => {
          return group.sort((a, b) => {
            const aIndex = allMaintainers.findIndex(
              (m) => m.github === a.github
            )
            const bIndex = allMaintainers.findIndex(
              (m) => m.github === b.github
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
              (m) => m.github === a.github
            )
            const bIndex = allMaintainers.findIndex(
              (m) => m.github === b.github
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
          (m) => getRoleForFilteredLibraries(m, search.libraries) === 'creator'
        )
        const libraryMaintainers = filteredMaintainers.filter(
          (m) =>
            getRoleForFilteredLibraries(m, search.libraries) === 'maintainer'
        )
        const libraryContributors = filteredMaintainers.filter(
          (m) =>
            getRoleForFilteredLibraries(m, search.libraries) === 'contributor'
        )

        // Sort each role group: core maintainers first, then by original order
        const sortRoleGroup = (group: Maintainer[]) => {
          return group.sort((a, b) => {
            const aIndex = allMaintainers.findIndex(
              (m) => m.github === a.github
            )
            const bIndex = allMaintainers.findIndex(
              (m) => m.github === b.github
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
    (search.libraries && search.libraries.length > 0) ||
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

      <div className="flex flex-col w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
        <div className="flex-1 flex flex-col gap-16 w-full max-w-4xl mx-auto">
          <header className="text-center pt-8">
            <h1 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mb-6">
              Maintainers & Contributors
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Meet the amazing developers who make TanStack possible through
              their contributions, maintenance, and dedication to open source
            </p>
          </header>

          <MaintainersFilter
            selectedLibraries={search.libraries}
            viewMode={search.viewMode}
            groupBy={search.groupBy}
            sortBy={search.sortBy}
            onLibrariesChange={(libraries) => updateFilters({ libraries })}
            onViewModeChange={(viewMode) => updateFilters({ viewMode })}
            onGroupByChange={(groupBy) => updateFilters({ groupBy })}
            onSortByChange={(sortBy) => updateFilters({ sortBy })}
            onClearAll={() => navigate({ search: {}, replace: true })}
          />

          {hasResults ? (
            <div>
              {hasFilters && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                  Showing {filteredMaintainers.length} maintainer
                  {filteredMaintainers.length === 1 ? '' : 's'}
                  {search.libraries && search.libraries.length > 0 && (
                    <span>
                      {' '}
                      for{' '}
                      <span className="font-medium">
                        {search.libraries.join(', ')}
                      </span>
                    </span>
                  )}
                </p>
              )}

              {groupedMaintainers.map((group, index) => (
                <MaintainerGrid
                  key={group.title || 'all'}
                  maintainers={group.maintainers}
                  viewMode={search.viewMode}
                  title={group.title}
                  stats={stats}
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
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
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
        <Footer />
      </div>
    </>
  )
}
