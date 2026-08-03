import { Link, createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { Card } from '~/components/Card'
import { PartnerStatusFilter } from '~/components/PartnerStatusFilter'
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
import * as React from 'react'
import { Button } from '~/ui'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'
import { getPartnerWindowLabel } from '~/utils/partner-lifecycle'
import {
  getPartnerDirectoryMetadata,
  getPartnerDirectorySearch,
  normalizePartnerDirectorySearch,
  partnerDirectorySearchSchema,
  type PartnerDirectoryStatus,
} from '~/utils/partner-directory'
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'

type NormalizedPartnersSearch = {
  status: PartnerDirectoryStatus
}
type PartnersSearchUpdates = {
  status: PartnerDirectoryStatus
}

const defaultPartnersSearch: NormalizedPartnersSearch = {
  status: 'active',
}

export const Route = createFileRoute('/partners/')({
  component: PartnersIndexPage,
  validateSearch: partnerDirectorySearchSchema,
  loaderDeps: ({ search }) => normalizePartnerDirectorySearch(search),
  loader: ({ deps }) => deps,
  staticData: {
    includeSearchInCanonical: true,
  },
  head: ({ loaderData }) => {
    const metadata = getPartnerDirectoryMetadata(
      loaderData?.status ?? defaultPartnersSearch.status,
    )

    return {
      meta: seo(metadata),
    }
  },
})

function getFilteredPartners(search: NormalizedPartnersSearch) {
  const normalizedSearch = normalizePartnerDirectorySearch(search)

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
      <h2
        id={`partner-tier-${tier}`}
        className={`flex items-center gap-2 px-3 py-1 rounded-full ${flare.labelColor}`}
      >
        <span className={flare.iconColor}>{flare.icon}</span>
        <span className="text-xs uppercase tracking-[0.2em] font-bold">
          {partnerTierLabels[tier]} Partners
        </span>
      </h2>
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
        <section
          key={section.tier}
          aria-labelledby={`partner-tier-${section.tier}`}
        >
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
  const search = normalizePartnerDirectorySearch(Route.useSearch())
  const navigate = Route.useNavigate()

  const trackFiltersChanged = React.useCallback(
    (nextSearch: NormalizedPartnersSearch, change: 'status_changed') => {
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
    const nextSearch = normalizePartnerDirectorySearch({
      ...search,
      ...updates,
    })

    navigate({
      search: () => getPartnerDirectorySearch(nextSearch.status),
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

        <PartnerStatusFilter
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
            href={PARTNER_INQUIRY_HREF}
            className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            onClick={() => trackPartnerInquiry('partners_index_cta')}
          >
            Get in Touch
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
