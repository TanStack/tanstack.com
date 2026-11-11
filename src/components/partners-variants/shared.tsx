import * as React from 'react'
import {
  getPartnerHref,
  partners as allPartners,
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

// Shared by the seven exploratory partner-section variants (?partners=1…7).
// Only the pieces every variant needs identically live here: tier grouping and
// the tracked link. Layout stays in each variant.

export type VariantPartner = (typeof allPartners)[number]

export type PartnersVariantProps = {
  analyticsPlacement: PartnerPlacement
}

export const eyebrowClassName =
  'font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted'

export const tierDotClassName: Record<PartnerTier, string> = {
  gold: 'bg-ds-amber-300',
  silver: 'bg-ds-neutral-200',
  bronze: 'bg-ds-terracotta-300',
}

/** Active partners grouped by tier, in the same rotated order and with the
 *  same running slot index the default grid reports to analytics. */
export function usePartnerVariantTiers(analyticsPlacement: PartnerPlacement) {
  const placementContext = usePartnerPlacementContext({
    orderStrategy: 'tier-rotated',
    surface: analyticsPlacement,
  })

  const groups = getPartnerTierGroupsForPlacement(
    allPartners.filter((partner) => partner.status === 'active'),
    placementContext,
  )

  let slotIndex = 0
  const tiers = groups.map((group) => ({
    tier: group.tier,
    partners: group.partners.map((partner) => ({
      partner,
      index: slotIndex++,
    })),
  }))

  return { placementContext, tiers }
}

/** The partner anchor with the default grid's impression + click analytics. */
export function PartnerVariantLink({
  analyticsPlacement,
  placementContext,
  partner,
  index,
  className,
  children,
  onPreview,
}: {
  analyticsPlacement: PartnerPlacement
  placementContext: PartnerPlacementContext
  partner: VariantPartner
  index: number
  className?: string
  children: React.ReactNode
  /** Fired on hover and keyboard focus — for variants that preview a partner. */
  onPreview?: () => void
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
  const href = getPartnerHref(partner, analyticsPlacement)

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${className ?? ''}`}
      onMouseEnter={onPreview}
      onFocus={onPreview}
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
      {children}
    </a>
  )
}
