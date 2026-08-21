import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  partnerTierFlares,
  partnerTierLabels,
  type PartnerTier,
  type RailPartner,
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
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'
import { PartnerTierLogo, type PartnerLogoSizing } from './PartnerTierLogo'

// Per-tier LAYOUT (not logo size — that lives in the rubric). Every tier is a
// single column; lower tiers rest more muted and lift to color on hover.
const tierLayout: Record<
  PartnerTier,
  { rowHeight: string; idleOpacity: string }
> = {
  gold: { rowHeight: 'h-[80px]', idleOpacity: '' },
  silver: { rowHeight: 'h-[62px]', idleOpacity: 'opacity-80' },
  bronze: { rowHeight: 'h-[56px]', idleOpacity: 'opacity-65' },
}

// Centered tier header: a hairline on each side of the tier's icon + label.
function TierHeader({ tier }: { tier: PartnerTier }) {
  const flare = partnerTierFlares[tier]
  return (
    <div className="flex w-full items-center gap-2">
      <span className="h-px flex-1 bg-border-default" />
      <span className={twMerge('flex items-center gap-1.5', flare.labelColor)}>
        <span className={flare.iconColor}>{flare.icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
          {partnerTierLabels[tier]}
        </span>
      </span>
      <span className="h-px flex-1 bg-border-default" />
    </div>
  )
}

/**
 * The tiered partner rail: partners grouped into centered tier sections, each
 * logo sized by the shared rubric (see PartnerTierLogo / PartnerRail.rules.md).
 * `sizing` and `scaleOverrides` are workshop hooks — omit them in production.
 */
export function PartnerRail({
  analyticsPlacement,
  partners,
  title = 'Partners',
  titleTo = '/partners',
  sizing,
  scaleOverrides,
  rowGaps,
}: {
  analyticsPlacement: PartnerPlacement
  partners: Array<RailPartner>
  title?: string
  titleTo?: '/partners'
  sizing?: PartnerLogoSizing
  scaleOverrides?: Record<string, number>
  /** Vertical gap (px) between logo rows, per tier — workshop hook. */
  rowGaps?: Partial<Record<PartnerTier, number>>
}) {
  const placementContext = usePartnerPlacementContext({
    orderStrategy: 'tier-rotated',
    surface: analyticsPlacement,
  })

  const rowsByTier = getPartnerTierGroupsForPlacement(
    partners,
    placementContext,
  )

  let slotIndex = 0

  return (
    <div className="group/rail flex w-full flex-col gap-6">
      <div className="flex w-full items-center justify-between gap-2">
        <Link
          className="text-xs font-medium opacity-60 hover:opacity-100"
          to={titleTo}
        >
          {title}
        </Link>
        <a
          href={PARTNER_INQUIRY_HREF}
          className="text-xs font-medium opacity-60 hover:underline hover:opacity-100"
          onClick={() => trackPartnerInquiry(analyticsPlacement)}
        >
          Become a Partner
        </a>
      </div>
      {rowsByTier.map((row) => (
        <section key={row.tier} className="flex w-full flex-col gap-2.5">
          <TierHeader tier={row.tier} />
          <div
            className="flex flex-col"
            style={
              rowGaps?.[row.tier] !== undefined
                ? { rowGap: rowGaps[row.tier] }
                : undefined
            }
          >
            {row.partners.map((partner) => {
              const index = slotIndex++
              return (
                <PartnerRailLogo
                  key={partner.id}
                  analyticsPlacement={analyticsPlacement}
                  index={index}
                  placementContext={placementContext}
                  partner={partner}
                  sizing={sizing}
                  scaleOverride={scaleOverrides?.[partner.id]}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function PartnerRailLogo({
  analyticsPlacement,
  index,
  placementContext,
  partner,
  sizing,
  scaleOverride,
}: {
  analyticsPlacement: PartnerPlacement
  index: number
  placementContext: PartnerPlacementContext
  partner: RailPartner
  sizing?: PartnerLogoSizing
  scaleOverride?: number
}) {
  const tier = partner.tier ?? 'bronze'
  const layout = tierLayout[tier]
  const analyticsMetadata = getPartnerPlacementAnalyticsMetadata(
    partner,
    placementContext,
  )
  const ref = useTrackedImpression<'partner_viewed', HTMLAnchorElement>({
    event: 'partner_viewed',
    props: {
      partner_id: partner.id,
      placement: analyticsPlacement,
      ...analyticsMetadata,
      slot_index: index,
    },
  })

  return (
    <a
      ref={ref}
      href={partner.href}
      target="_blank"
      rel="noreferrer"
      className={twMerge(
        'flex w-full items-center justify-center overflow-hidden px-2 transition-colors duration-150 ease-out hover:bg-gray-500/10',
        layout.rowHeight,
      )}
      onClick={() => {
        let destinationHost: string | undefined
        try {
          destinationHost = new URL(partner.href).host
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
      <PartnerTierLogo
        image={partner.image}
        name={partner.name}
        tier={tier}
        sizing={sizing}
        scaleOverride={scaleOverride}
        className={twMerge(
          'grayscale brightness-90 transition-[filter,opacity] duration-500 ease-out group-hover/rail:grayscale-0 group-hover/rail:brightness-100 group-hover/rail:opacity-100',
          layout.idleOpacity,
        )}
      />
    </a>
  )
}
