import { createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { Card } from '~/components/Card'
import {
  partners,
  PartnerImage,
  partnerTierFlares,
  partnerTierLabels,
  partnerTierOrder,
  type PartnerTier,
} from '~/utils/partners'
import { seo } from '~/utils/seo'
import { Library } from '~/libraries'
import { useState } from 'react'
import * as React from 'react'
import { ListFilter, X } from 'lucide-react'
import { Button } from '~/ui'
import { startProject } from '~/libraries/start'
import { routerProject } from '~/libraries/router'
import { queryProject } from '~/libraries/query'
import { tableProject } from '~/libraries/table'
import { configProject } from '~/libraries/config'
import { dbProject } from '~/libraries/db'
import { aiProject } from '~/libraries/ai'
import { formProject } from '~/libraries/form'
import { pacerProject } from '~/libraries/pacer'
import { rangerProject } from '~/libraries/ranger'
import { storeProject } from '~/libraries/store'
import { virtualProject } from '~/libraries/virtual'
import { libraryIdSchema } from '~/utils/schemas'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'
import * as v from 'valibot'

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
  aiProject,
  configProject,
]

const statusSchema = v.picklist(['active', 'inactive'])

const searchSchema = v.object({
  libraries: v.fallback(v.optional(v.array(libraryIdSchema)), undefined),
  status: v.fallback(v.optional(statusSchema, 'active'), 'active'),
})

type PartnersSearch = v.InferOutput<typeof searchSchema>
type PartnersSearchUpdates = {
  libraries?: Library['id'][] | undefined
  status?: 'active' | 'inactive' | undefined
}

const defaultPartnersSearch = {
  status: 'active',
} satisfies PartnersSearch

function normalizePartnersSearch(
  search: Partial<PartnersSearch>,
): PartnersSearch {
  return {
    libraries: search.libraries?.length ? search.libraries : undefined,
    status: search.status ?? defaultPartnersSearch.status,
  }
}

function getPartnerFilterAnalytics(search: PartnersSearch) {
  return {
    active_filters_count:
      (search.libraries?.length ?? 0) + (search.status ? 1 : 0),
    filter_libraries: search.libraries,
    filter_status: search.status,
  }
}

export const Route = createFileRoute('/partners/')({
  component: PartnersIndexPage,
  validateSearch: searchSchema,
  staticData: {
    includeSearchInCanonical: true,
  },
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
        <div className="relative" data-filter-dropdown>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            Filter Partners
            {hasFilters && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs">
                {filterCount}
              </span>
            )}
          </button>

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

                <div className="mb-4">
                  <label
                    htmlFor="partner-status"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2"
                  >
                    Partner Status
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onStatusChange(
                          selectedStatus === 'active' ? undefined : 'active',
                        )
                      }}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedStatus === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Current Partners
                    </button>
                    <button
                      onClick={() => {
                        onStatusChange(
                          selectedStatus === 'inactive'
                            ? undefined
                            : 'inactive',
                        )
                      }}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedStatus === 'inactive'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Previous Partners
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="library-filter"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2"
                  >
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
                              : `${bgStyle}/30 text-gray-600 dark:text-gray-400 hover:${bgStyle}/40`
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

        {hasFilters && (
          <div className="flex flex-wrap gap-2">
            {selectedLibraries?.map((libraryId) => {
              const library = availableLibraries.find(
                (lib) => lib.id === libraryId,
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
                    <X className="w-3 h-3" />
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

function getFilteredPartners(search: PartnersSearch) {
  const normalizedSearch = normalizePartnersSearch(search)

  return partners.filter((partner) => {
    if (normalizedSearch.status && partner.status !== normalizedSearch.status) {
      return false
    }

    if (normalizedSearch.libraries && normalizedSearch.libraries.length > 0) {
      return partner.libraries?.some((library) =>
        normalizedSearch.libraries?.includes(library as Library['id']),
      )
    }

    return true
  })
}

type CardSize = 'gold' | 'silver' | 'bronze' | 'flat'

const cardSizeLayout: Record<
  CardSize,
  {
    padding: string
    logoFrame: string
    logoMaxHeight: string
    titleSize: string
    showDescription: boolean
  }
> = {
  gold: {
    padding: 'p-8',
    logoFrame: 'h-32',
    logoMaxHeight: 'max-h-24',
    titleSize: 'text-2xl',
    showDescription: true,
  },
  silver: {
    padding: 'p-6',
    logoFrame: 'h-24',
    logoMaxHeight: 'max-h-16',
    titleSize: 'text-lg',
    showDescription: true,
  },
  bronze: {
    padding: 'p-4',
    logoFrame: 'h-16',
    logoMaxHeight: 'max-h-10',
    titleSize: 'text-sm',
    showDescription: false,
  },
  flat: {
    padding: 'p-6',
    logoFrame: 'h-24',
    logoMaxHeight: 'max-h-16',
    titleSize: 'text-xl',
    showDescription: true,
  },
}

function PartnerDirectoryCard({
  filters,
  isShowingPrevious,
  partner,
  slotIndex,
  size = 'flat',
}: {
  filters: PartnersSearch
  isShowingPrevious: boolean
  partner: (typeof partners)[number]
  slotIndex: number
  size?: CardSize
}) {
  const ref = useTrackedImpression<HTMLAnchorElement>({
    event: 'partner_impression',
    properties: {
      partner_id: partner.id,
      partner_name: partner.name,
      partner_status: partner.status,
      placement: 'partners_directory_card',
      slot_index: slotIndex,
      ...getPartnerFilterAnalytics(filters),
    },
  })

  const duration =
    isShowingPrevious && partner.startDate && partner.endDate
      ? `${partner.startDate} - ${partner.endDate}`
      : null

  const layout = cardSizeLayout[size]

  return (
    <a
      ref={ref}
      href={`/partners/${partner.id}`}
      className="block"
      onClick={() => {
        trackEvent('partner_card_clicked', {
          partner_id: partner.id,
          partner_name: partner.name,
          partner_status: partner.status,
          placement: 'partners_directory_card',
          slot_index: slotIndex,
          ...getPartnerFilterAnalytics(filters),
        })
      }}
    >
      <Card className="overflow-hidden hover:border-blue-500/40 hover:shadow-lg transition-all h-full">
        <div className={`${layout.padding} h-full flex flex-col`}>
          <div
            className={`mb-4 ${layout.logoFrame} flex items-center justify-center`}
          >
            <PartnerImage
              className={`w-full object-contain ${layout.logoMaxHeight}`}
              config={partner.image}
              alt={partner.name}
            />
          </div>
          <h3 className={`text-center ${layout.titleSize} font-semibold mb-2`}>
            {partner.name}
          </h3>
          {partner.tagline && (
            <p className="text-center text-xs text-gray-600 dark:text-gray-400 mb-4">
              {partner.tagline}
            </p>
          )}
          {layout.showDescription && (
            <div className="text-sm flex-1">
              {isShowingPrevious ? (
                <>
                  {duration && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
                      {duration}
                    </p>
                  )}
                  {partner.libraries && partner.libraries.length > 0 && (
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
                <p className="text-gray-700 dark:text-gray-300">
                  {partner.llmDescription}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </a>
  )
}

const tierGridCols: Record<PartnerTier, string> = {
  gold: 'grid grid-cols-1 lg:grid-cols-2 gap-6',
  silver: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
  bronze: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4',
}

function TierSectionHeader({ tier }: { tier: PartnerTier }) {
  const flare = partnerTierFlares[tier]
  return (
    <div className="flex items-center gap-4 mb-8">
      <div
        className={`h-px flex-1 bg-gradient-to-r from-transparent ${flare.gradientStops}`}
      />
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full ${flare.labelColor}`}
      >
        <span className={flare.iconColor}>{flare.icon}</span>
        <span className="text-xs uppercase tracking-[0.2em] font-bold">
          {partnerTierLabels[tier]}
        </span>
      </div>
      <div
        className={`h-px flex-1 bg-gradient-to-l from-transparent ${flare.gradientStops}`}
      />
    </div>
  )
}

function TieredPartnerSections({
  partners: allPartners,
  filters,
}: {
  partners: Array<(typeof partners)[number]>
  filters: PartnersSearch
}) {
  const tiers: Array<PartnerTier> = ['gold', 'silver', 'bronze']

  const sections = tiers
    .map((tier) => ({
      tier,
      partners: allPartners
        .filter((partner) => (partner.tier ?? 'bronze') === tier)
        .sort((a, b) => b.score - a.score),
    }))
    .filter((section) => section.partners.length > 0)
    .sort((a, b) => partnerTierOrder[a.tier] - partnerTierOrder[b.tier])

  let slotIndex = 0

  return (
    <div className="space-y-16">
      {sections.map((section) => (
        <section key={section.tier}>
          <TierSectionHeader tier={section.tier} />
          <div className={tierGridCols[section.tier]}>
            {section.partners.map((partner) => {
              const index = slotIndex++
              return (
                <PartnerDirectoryCard
                  key={partner.id}
                  filters={filters}
                  isShowingPrevious={false}
                  partner={partner}
                  slotIndex={index}
                  size={section.tier}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function PartnersIndexPage() {
  const search = normalizePartnersSearch(Route.useSearch())
  const navigate = Route.useNavigate()

  const trackFiltersChanged = React.useCallback(
    (nextSearch: PartnersSearch, action: string) => {
      trackEvent('partners_filter_changed', {
        action,
        ...getPartnerFilterAnalytics(nextSearch),
        result_count: getFilteredPartners(nextSearch).length,
      })
    },
    [],
  )

  const updateFilters = (updates: PartnersSearchUpdates, action = 'update') => {
    const nextSearch = normalizePartnersSearch({
      ...search,
      ...updates,
    })

    navigate({
      search: () => nextSearch,
      replace: true,
    })

    trackFiltersChanged(nextSearch, action)
  }

  const filteredPartners = getFilteredPartners(search)

  const hasStatusFilter = search.status
  const hasLibraryFilter = search.libraries && search.libraries.length > 0
  const hasResults = filteredPartners.length > 0
  const isShowingPrevious = search.status === 'inactive'
  const isShowingActive = search.status === 'active'

  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-16 w-full max-w-4xl mx-auto">
        <header>
          <h1 className="text-3xl font-black">
            {isShowingPrevious
              ? 'Previous Partners'
              : isShowingActive
                ? 'Current Partners'
                : 'Partners'}
          </h1>
          <p className="text-lg mt-4 text-gray-600 dark:text-gray-400">
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
          onLibrariesChange={(libraries) =>
            updateFilters({ libraries }, 'libraries_changed')
          }
          onStatusChange={(status) =>
            updateFilters({ status }, 'status_changed')
          }
          onClearAll={() => {
            navigate({ search: () => defaultPartnersSearch, replace: true })
            trackFiltersChanged(defaultPartnersSearch, 'clear_all')
          }}
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
                {hasLibraryFilter && search.libraries && (
                  <span>
                    {' '}
                    for{' '}
                    {search.libraries.length === 1 ? 'library' : 'libraries'}:{' '}
                    <span className="font-medium">
                      {search.libraries.join(', ')}
                    </span>
                  </span>
                )}
              </p>
            )}

            {isShowingActive && !hasLibraryFilter ? (
              <TieredPartnerSections
                partners={filteredPartners}
                filters={search}
              />
            ) : (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPartners.map((partner, slotIndex) => (
                  <PartnerDirectoryCard
                    key={partner.id}
                    filters={search}
                    isShowingPrevious={isShowingPrevious}
                    partner={partner}
                    slotIndex={slotIndex}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-600 dark:text-gray-400">
            {hasStatusFilter || hasLibraryFilter ? (
              <div>
                <p className="text-lg mb-4">
                  No partners found for the selected filters.
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate({ search: {}, replace: true })}
                >
                  View All Partners
                </Button>
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
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
            We're always looking for organizations that share our values and
            want to support open source development.
          </p>
          <a
            href="mailto:partners@tanstack.com?subject=TanStack Partnership Inquiry"
            className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            onClick={() => {
              trackEvent('partner_inquiry_clicked', {
                placement: 'partners_page_cta',
              })
            }}
          >
            Get in Touch
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
