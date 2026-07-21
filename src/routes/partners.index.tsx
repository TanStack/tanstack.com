import { Link, createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { Card } from '~/components/Card'
import {
  partners,
  PartnerImage,
  partnerTierFlares,
  partnerTierLabels,
  type PartnerTier,
} from '~/utils/partners'
import {
  getPartnerPlacementAnalyticsMetadata,
  getPartnersForPlacement,
  getPartnerTierGroupsForPlacement,
  type PartnerPlacementContext,
} from '~/utils/partner-placement'
import { usePartnerPlacementContext } from '~/utils/usePartnerPlacementContext'
import { seo } from '~/utils/seo'
import { useState } from 'react'
import * as React from 'react'
import { ListFilter } from 'lucide-react'
import { Button } from '~/ui'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'
import { getPartnerWindowLabel } from '~/utils/partner-lifecycle'
import * as v from 'valibot'

const statusSchema = v.picklist(['active', 'inactive'])

const searchSchema = v.object({
  status: v.fallback(v.optional(statusSchema, 'active'), 'active'),
})

type PartnersSearch = v.InferOutput<typeof searchSchema>
type PartnersSearchUpdates = {
  status: 'active' | 'inactive'
}

const defaultPartnersSearch = {
  status: 'active',
} satisfies PartnersSearch

function normalizePartnersSearch(
  search: Partial<PartnersSearch>,
): PartnersSearch {
  return {
    status: search.status ?? defaultPartnersSearch.status,
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
  selectedStatus: 'active' | 'inactive'
  onStatusChange: (status: 'active' | 'inactive') => void
}

function PartnersFilter({ selectedStatus, onStatusChange }: FilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const selectStatus = (status: 'active' | 'inactive') => {
    onStatusChange(status)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest('[data-filter-dropdown]')
      ) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen])

  const hasNonDefaultFilter = selectedStatus !== defaultPartnersSearch.status

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative" data-filter-dropdown>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-controls="partner-status-filter"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            Filter Partners
            {hasNonDefaultFilter && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs">
                1
              </span>
            )}
          </button>

          {isOpen && (
            <div
              id="partner-status-filter"
              role="dialog"
              aria-label="Filter partners by status"
              className="absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Partner Status
                  </span>
                  {hasNonDefaultFilter && (
                    <button
                      type="button"
                      onClick={() => selectStatus('active')}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div
                  className="flex gap-2"
                  role="group"
                  aria-label="Partner status"
                >
                  <button
                    type="button"
                    aria-pressed={selectedStatus === 'active'}
                    onClick={() => selectStatus('active')}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedStatus === 'active'
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Current Partners
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectedStatus === 'inactive'}
                    onClick={() => selectStatus('inactive')}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedStatus === 'inactive'
                        ? 'bg-orange-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Previous Partners
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
  isShowingPrevious,
  placementContext,
  partner,
  slotIndex,
  size = 'flat',
}: {
  isShowingPrevious: boolean
  placementContext: PartnerPlacementContext
  partner: (typeof partners)[number]
  slotIndex: number
  size?: CardSize
}) {
  const analyticsMetadata = getPartnerPlacementAnalyticsMetadata(
    partner,
    placementContext,
  )
  const ref = useTrackedImpression<'partner_viewed', HTMLAnchorElement>({
    event: 'partner_viewed',
    props: {
      partner_id: partner.id,
      placement: 'directory',
      ...analyticsMetadata,
      slot_index: slotIndex,
    },
  })

  const duration = isShowingPrevious ? getPartnerWindowLabel(partner) : null

  const layout = cardSizeLayout[size]

  return (
    <Link
      ref={ref}
      to="/partners/$partner"
      params={{ partner: partner.id }}
      className="block"
      onClick={() => {
        trackEvent('partner_clicked', {
          partner_id: partner.id,
          placement: 'directory',
          destination: 'internal_detail',
          ...analyticsMetadata,
          slot_index: slotIndex,
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
                duration && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
                    {duration}
                  </p>
                )
              ) : (
                <p className="text-gray-700 dark:text-gray-300">
                  {partner.llmDescription}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
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
        className={`h-px flex-1 bg-linear-to-r from-transparent ${flare.gradientStops}`}
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
        className={`h-px flex-1 bg-linear-to-l from-transparent ${flare.gradientStops}`}
      />
    </div>
  )
}

function TieredPartnerSections({
  partners: allPartners,
  placementContext,
}: {
  partners: Array<(typeof partners)[number]>
  placementContext: PartnerPlacementContext
}) {
  const sections = getPartnerTierGroupsForPlacement(
    allPartners,
    placementContext,
  )

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
                  isShowingPrevious={false}
                  placementContext={placementContext}
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
    (nextSearch: PartnersSearch, change: 'status_changed') => {
      trackEvent('partner_filter_applied', {
        change,
        status_filter: nextSearch.status ?? null,
        result_count: getFilteredPartners(nextSearch).length,
      })
    },
    [],
  )

  const updateFilters = (
    updates: PartnersSearchUpdates,
    change: 'status_changed',
  ) => {
    const nextSearch = normalizePartnersSearch({
      ...search,
      ...updates,
    })

    navigate({
      search: () => nextSearch,
      replace: true,
    })

    trackFiltersChanged(nextSearch, change)
  }

  const filteredPartners = getFilteredPartners(search)

  const hasResults = filteredPartners.length > 0
  const isShowingPrevious = search.status === 'inactive'
  const isShowingActive = search.status === 'active'
  const placementContext = usePartnerPlacementContext({
    orderStrategy: isShowingActive ? 'tier-rotated' : 'static-curated',
    surface: 'directory',
  })
  const displayPartners = getPartnersForPlacement(
    filteredPartners,
    placementContext,
  )

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
          selectedStatus={search.status}
          onStatusChange={(status) =>
            updateFilters({ status }, 'status_changed')
          }
        />

        {hasResults ? (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
              Showing {filteredPartners.length} partner
              {filteredPartners.length === 1 ? '' : 's'} (
              {isShowingPrevious ? 'previous' : 'current'})
            </p>

            {isShowingActive ? (
              <TieredPartnerSections
                partners={filteredPartners}
                placementContext={placementContext}
              />
            ) : (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {displayPartners.map((partner, slotIndex) => (
                  <PartnerDirectoryCard
                    key={partner.id}
                    isShowingPrevious={isShowingPrevious}
                    placementContext={placementContext}
                    partner={partner}
                    slotIndex={slotIndex}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-600 dark:text-gray-400">
            <div>
              <p className="text-lg mb-4">
                No {isShowingPrevious ? 'previous' : 'current'} partners found.
              </p>
              {isShowingPrevious && (
                <Button
                  size="sm"
                  onClick={() =>
                    updateFilters({ status: 'active' }, 'status_changed')
                  }
                >
                  View Current Partners
                </Button>
              )}
            </div>
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
              trackEvent('partner_inquiry_started', {
                placement: 'partners_index_cta',
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
