import * as React from 'react'
import {
  getPartnerHref,
  partners as allPartners,
  PartnerImage,
  partnerTierBandColor,
  partnerTierLabels,
  type PartnerTier,
} from '~/utils/partners'
import {
  getPartnerPlacementAnalyticsMetadata,
  getPartnerTierGroupsForPlacement,
  type PartnerPlacementContext,
} from '~/utils/partner-placement'
import { usePartnerPlacementContext } from '~/utils/usePartnerPlacementContext'
import {
  trackEvent,
  useTrackedImpression,
  type PartnerPlacement,
} from '~/utils/analytics'

type PartnerItem = (typeof allPartners)[number]

type PartnersGridProps = {
  analyticsPlacement?: PartnerPlacement
  partnersList?: PartnerItem[]
  status?: PartnerItem['status']
  /**
   * Optional final band rendered inside the same bordered container as the tier
   * bands — used to fold the OSS Sponsors band into the stack.
   */
  trailingBand?: React.ReactNode
}

/**
 * A full-bleed tier header bar (Figma 640:3878). Exported so the shared
 * partners/sponsors block can render its final band with the same treatment.
 */
export function TierBand({
  label,
  colorClassName,
}: {
  label: string
  colorClassName: string
}) {
  return (
    <div
      className={`flex items-center justify-center px-4 py-2.5 ${colorClassName}`}
    >
      <span className="font-ds-display text-ds-heading-5 uppercase tracking-wide text-ds-neutral-500">
        {label}
      </span>
    </div>
  )
}

const tierLayout: Record<
  PartnerTier,
  {
    flexBasis: string
    minHeight: string
    logoMaxWidth: string
    logoMaxHeight: string
    padding: string
  }
> = {
  gold: {
    flexBasis: 'basis-1/2 lg:basis-1/3',
    minHeight: 'min-h-[144px]',
    logoMaxWidth: 'max-w-[240px]',
    logoMaxHeight: 'max-h-[72px]',
    padding: 'p-6 sm:p-8',
  },
  silver: {
    flexBasis: 'basis-1/2 sm:basis-1/3 lg:basis-1/4',
    minHeight: 'min-h-[104px]',
    logoMaxWidth: 'max-w-[150px]',
    logoMaxHeight: 'max-h-[44px]',
    padding: 'p-6',
  },
  bronze: {
    flexBasis: 'basis-1/3 sm:basis-1/4 lg:basis-1/5',
    minHeight: 'min-h-[88px]',
    logoMaxWidth: 'max-w-[110px]',
    logoMaxHeight: 'max-h-[32px]',
    padding: 'p-4',
  },
}

function PartnerGridItem({
  analyticsPlacement,
  index,
  placementContext,
  partner,
}: {
  analyticsPlacement: PartnerPlacement
  index: number
  placementContext: PartnerPlacementContext
  partner: PartnerItem
}) {
  const analyticsMetadata = getPartnerPlacementAnalyticsMetadata(
    partner,
    placementContext,
  )
  const ref = useTrackedImpression<'partner_viewed', HTMLAnchorElement>({
    event: 'partner_viewed',
    props: {
      partner_id: partner.id,
      ...analyticsMetadata,
      placement: analyticsPlacement,
      slot_index: index,
    },
  })

  const layout = tierLayout[partner.tier ?? 'bronze']
  const href = getPartnerHref(partner, analyticsPlacement)

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center
        border-r border-b border-gray-200 dark:border-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors duration-150 ease-out
        ${layout.flexBasis} ${layout.minHeight} ${layout.padding}`}
      onClick={() => {
        let destinationHost: string | undefined
        try {
          destinationHost = new URL(href).host
        } catch {
          // Bad/relative href — track without host rather than dropping.
        }
        trackEvent('partner_clicked', {
          partner_id: partner.id,
          placement: analyticsPlacement,
          destination: 'external',
          destination_host: destinationHost,
          ...analyticsMetadata,
          slot_index: index,
        })
      }}
    >
      <div
        className={`w-full flex items-center justify-center ${layout.logoMaxWidth}`}
      >
        <PartnerImage
          className={`w-full object-contain ${layout.logoMaxHeight}`}
          config={partner.image}
          alt={partner.name}
        />
      </div>
    </a>
  )
}

export function PartnersGrid({
  analyticsPlacement = 'grid',
  partnersList,
  status = 'active',
  trailingBand,
}: PartnersGridProps) {
  const items = (partnersList ?? allPartners).filter(
    (partner) => partner.status === status,
  )

  const placementContext = usePartnerPlacementContext({
    orderStrategy: 'tier-rotated',
    surface: analyticsPlacement,
  })

  const tiersWithPartners = getPartnerTierGroupsForPlacement(
    items,
    placementContext,
  )

  let slotIndex = 0

  // One continuous bordered stack. Each tier is a full-bleed colored band
  // followed by its logo grid; the negative right/bottom margins let the cell
  // dividers meet the container edge so overflow-hidden trims the outer line.
  return (
    <div className="overflow-hidden rounded-2xl corner-squircle border border-gray-200 dark:border-gray-800">
      {tiersWithPartners.map((row) => (
        <React.Fragment key={row.tier}>
          <TierBand
            label={partnerTierLabels[row.tier]}
            colorClassName={partnerTierBandColor[row.tier]}
          />
          <div className="flex flex-wrap items-stretch -mr-px -mb-px">
            {row.partners.map((partner) => {
              const index = slotIndex++
              return (
                <PartnerGridItem
                  key={partner.id}
                  analyticsPlacement={analyticsPlacement}
                  index={index}
                  placementContext={placementContext}
                  partner={partner}
                />
              )
            })}
          </div>
        </React.Fragment>
      ))}
      {trailingBand}
    </div>
  )
}
