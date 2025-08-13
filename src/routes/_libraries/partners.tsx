import { Footer } from '~/components/Footer'
import { partners } from '~/utils/partners'
import { seo } from '~/utils/seo'
import { z } from 'zod'
import { Library } from '~/libraries'
import { useState } from 'react'
import * as React from 'react'
import { MdClose, MdFilterList } from 'react-icons/md'
import { startProject } from '~/libraries/start'
import { routerProject } from '~/libraries/router'
import { queryProject } from '~/libraries/query'
import { tableProject } from '~/libraries/table'
import { configProject } from '~/libraries/config'
import { dbProject } from '~/libraries/db'
import { formProject } from '~/libraries/form'
import { pacerProject } from '~/libraries/pacer'
import { rangerProject } from '~/libraries/ranger'
import { storeProject } from '~/libraries/store'
import { virtualProject } from '~/libraries/virtual'

const availableLibraries = [
  startProject,
  routerProject,
  queryProject,
  tableProject,
  formProject,
  virtualProject,
  rangerProject,
  storeProject,
  pacerProject,
  dbProject,
  configProject,
]

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
  'devtools',
  'create-tsrouter-app',
])

const statusSchema = z.enum(['active', 'inactive'])

export const Route = createFileRoute({
  component: RouteComp,
  validateSearch: z.object({
    libraries: z.array(librarySchema).optional().catch(undefined),
    status: statusSchema.optional().default('active').catch('active'),
  }),
  head: () => ({
    meta: seo({
      title: 'Partners',
      description:
        'Companies and organizations supporting TanStack and our open source mission',
    }),
  }),
})

interface FilterProps {
  selectedLibraries: Library['id'][] | undefined
  selectedStatus: 'active' | 'inactive' | undefined
  onLibrariesChange: (libraries: Library['id'][] | undefined) => void
  onStatusChange: (status: 'active' | 'inactive' | undefined) => void
  onClearAll: () => void
}
function PartnersFilter({
  selectedLibraries,
  selectedStatus,
  onLibrariesChange,
  onStatusChange,
  onClearAll,
}: FilterProps) {
  const [isOpen, setIsOpen] = useState(false)

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
    (selectedLibraries && selectedLibraries.length > 0) || selectedStatus
  const filterCount =
    (selectedLibraries?.length || 0) + (selectedStatus ? 1 : 0)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filter dropdown trigger */}
        <div className="relative" data-filter-dropdown>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <MdFilterList className="w-4 h-4" />
            Filter Partners
            {hasFilters && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs">
                {filterCount}
              </span>
            )}
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Filter Options
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

                {/* Status filter */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Partner Status
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Toggle: if currently inactive, turn off filter, otherwise set to inactive
                        onStatusChange(
                          selectedStatus === 'active' ? undefined : 'active'
                        )
                      }}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedStatus === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Current Partners
                    </button>
                    <button
                      onClick={() => {
                        // Toggle: if currently inactive, turn off filter, otherwise set to inactive
                        onStatusChange(
                          selectedStatus === 'inactive' ? undefined : 'inactive'
                        )
                      }}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedStatus === 'inactive'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Previous Partners
                    </button>
                  </div>
                </div>

                {/* Library filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter by Libraries
                  </label>
                  <div className="grid grid-cols-2 gap-2">
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
                              : `${bgStyle}/30 text-gray-700 dark:text-gray-300 hover:${bgStyle}/40`
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
        {hasFilters && (
          <div className="flex flex-wrap gap-2">
            {/* Library chips */}
            {selectedLibraries?.map((libraryId) => {
              const library = availableLibraries.find(
                (lib) => lib.id === libraryId
              )
              return (
                <span
                  key={libraryId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md text-xs"
                >
                  {library?.name || libraryId}
                  <button
                    onClick={() => toggleLibrary(libraryId)}
                    className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded p-0.5 transition-colors"
                  >
                    <MdClose className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RouteComp() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const updateFilters = (updates: {
    libraries?: Library['id'][] | undefined
    status?: 'active' | 'inactive' | undefined
  }) => {
    navigate({
      search: (s) => ({
        ...s,
        ...updates,
      }),
      replace: true,
    })
  }

  // Filter partners based on selected criteria
  const filteredPartners = partners.filter((partner) => {
    // Status filter - if no status specified, show all partners
    if (search.status && partner.status !== search.status) {
      return false
    }

    // Library filter
    if (search.libraries && search.libraries.length > 0) {
      // Include partners that match any of the selected libraries
      return partner.libraries?.some((lib) =>
        search.libraries!.includes(lib as Library['id'])
      )
    }

    return true
  })

  const hasStatusFilter = search.status
  const hasLibraryFilter = search.libraries && search.libraries.length > 0
  const hasResults = filteredPartners.length > 0
  const isShowingPrevious = search.status === 'inactive'
  const isShowingActive = search.status === 'active'

  return (
    <div className="flex flex-col w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-16 w-full max-w-4xl mx-auto">
        <header className="text-center pt-8">
          <h1 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mb-6">
            {isShowingPrevious
              ? 'Previous Partners'
              : isShowingActive
              ? 'Current Partners'
              : 'Partners'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {isShowingPrevious
              ? 'Companies and organizations that have supported TanStack in the past'
              : isShowingActive
              ? 'Companies and organizations currently supporting TanStack and our open source mission'
              : 'Companies and organizations supporting TanStack and our open source mission'}
          </p>
        </header>

        <PartnersFilter
          selectedLibraries={search.libraries}
          selectedStatus={search.status}
          onLibrariesChange={(libraries) => updateFilters({ libraries })}
          onStatusChange={(status) => updateFilters({ status })}
          onClearAll={() => navigate({ search: {}, replace: true })}
        />

        {hasResults ? (
          <div>
            {(hasStatusFilter || hasLibraryFilter) && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
                Showing {filteredPartners.length} partner
                {filteredPartners.length === 1 ? '' : 's'}
                {hasStatusFilter && (
                  <span>
                    {' '}
                    ({search.status === 'inactive' ? 'previous' : 'current'})
                  </span>
                )}
                {hasLibraryFilter && (
                  <span>
                    {' '}
                    for{' '}
                    {search.libraries!.length === 1
                      ? 'library'
                      : 'libraries'}:{' '}
                    <span className="font-medium">
                      {search.libraries!.join(', ')}
                    </span>
                  </span>
                )}
              </p>
            )}

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPartners.map((partner) => {
                const duration =
                  isShowingPrevious && partner.startDate && partner.endDate
                    ? `${partner.startDate} - ${partner.endDate}`
                    : null

                return (
                  <a
                    key={partner.id}
                    href={partner.href}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-black/40 dark:shadow-none overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="mb-4 h-24 flex items-center justify-center">
                        {partner.homepageImg}
                      </div>
                      <h3 className="text-center text-xl font-semibold mb-4">
                        {partner.name}
                      </h3>
                      <div className="text-sm">
                        {isShowingPrevious ? (
                          <>
                            {duration && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
                                {duration}
                              </p>
                            )}
                            {partner.libraries &&
                              partner.libraries.length > 0 && (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {partner.libraries.map((library) => (
                                    <span
                                      key={library}
                                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-md"
                                    >
                                      {library}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </>
                        ) : (
                          partner.content
                        )}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-600 dark:text-gray-400">
            {hasStatusFilter || hasLibraryFilter ? (
              <div>
                <p className="text-lg mb-4">
                  No partners found for the selected filters.
                </p>
                <button
                  onClick={() => navigate({ search: {}, replace: true })}
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                >
                  View All Partners
                </button>
              </div>
            ) : (
              <p>No partners to display.</p>
            )}
          </div>
        )}

        <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">
            Interested in Partnership?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
            We're always looking for organizations that share our values and
            want to support open source development.
          </p>
          <a
            href="mailto:partners@tanstack.com?subject=TanStack Partnership Inquiry"
            className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Get in Touch
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
