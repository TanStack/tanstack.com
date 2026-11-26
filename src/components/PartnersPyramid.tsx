import * as React from 'react'
import {
  PartnerImage,
  getPartnerHref,
  partnerTierLabels,
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

// Centered and borderless: whitespace and logo scale alone carry the hierarchy.
// Each tier is introduced by a hairline with its name set in it, which doubles
// as the section's heading — there is no separate "Partners" title.

type Partner = (typeof allPartners)[number]

export const partnerRuleHeadingClassName =
  'font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted'

// Equal visual weight: every logo in a tier is drawn at the same *area*, not
// fitted into the same box. A box makes a wide wordmark tiny and a compact mark
// huge; a fixed area gives the wide one more width and the compact one more
// height, so they read as the same size. Each tier steps down by 0.75 linear
// (0.5625 area), matching the DS partner-logo rubric.
const tierArea: Record<PartnerTier, number> = {
  gold: 12000,
  silver: 6750,
  bronze: 3800,
}

// Tallest a logo may get, so a near-square mark can't outgrow its row.
const tierMaxHeight: Record<PartnerTier, number> = {
  gold: 70,
  silver: 54,
  bronze: 40,
}

const FALLBACK_ASPECT = 4

// Equal area assumes the artwork fills its own frame. These logos don't — the
// file carries decoration or padding around the wordmark — so they need a
// linear boost to read at the same weight as their neighbours.
const opticalBoost: Partial<Record<string, number>> = {
  netlify: 1.3,
}

function AreaLogo({
  id,
  image,
  name,
  tier,
}: {
  id: string
  image: Partner['image']
  name: string
  tier: PartnerTier
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // The logo's own width/height ratio, read from the loaded image.
  const [aspect, setAspect] = React.useState(FALLBACK_ASPECT)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const images = Array.from(element.querySelectorAll('img'))
    const read = () => {
      const loaded = images.find(
        (img) => img.naturalWidth > 0 && img.naturalHeight > 0,
      )
      if (loaded) setAspect(loaded.naturalWidth / loaded.naturalHeight)
    }
    read()
    images.forEach((img) => img.addEventListener('load', read))
    return () => images.forEach((img) => img.removeEventListener('load', read))
  }, [])

  const height =
    Math.min(Math.sqrt(tierArea[tier] / aspect), tierMaxHeight[tier]) *
    (opticalBoost[id] ?? 1)

  return (
    // `max-w-full` is a guard for unusually wide wordmarks; the image keeps
    // its ratio, so only the size changes. The per-logo optical `scale` is
    // dropped: it was tuned for box-fitting.
    <div
      ref={ref}
      className="max-w-full"
      style={{
        width: `calc(${Math.round(height * aspect)}px * var(--logo-scale, 1))`,
      }}
    >
      <PartnerImage
        config={{ ...image, scale: undefined }}
        alt={name}
        className="h-auto w-full object-contain"
      />
    </div>
  )
}

// Logos are sized for the widest layout and scaled down as one group through
// `--logo-scale`, so every logo shrinks by the same factor and the tiers keep
// their relative weight. Each step is the largest scale at which the widest
// gold wordmark still fits its cell at that breakpoint's column count.
const logoScaleClassName =
  '[--logo-scale:0.55] sm:[--logo-scale:0.65] md:[--logo-scale:0.78] lg:[--logo-scale:0.8] xl:[--logo-scale:1]'

// `min-w-0` lets a cell be narrower than its logo's preferred width; without it
// the flex row drops to fewer columns instead of shrinking the logo.
const tierItem: Record<PartnerTier, string> = {
  gold: 'min-w-0 h-[calc(110px*var(--logo-scale))] basis-1/2 sm:basis-1/3 lg:basis-1/4',
  silver:
    'min-w-0 h-[calc(92px*var(--logo-scale))] basis-1/2 sm:basis-1/3 xl:basis-1/5',
  bronze:
    'min-w-0 h-[calc(74px*var(--logo-scale))] basis-1/2 sm:basis-1/4 xl:basis-1/6',
}

/** A hairline rule with a heading set in the middle of it. */
export function PartnerRuleHeading({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="h-px flex-1 bg-border-default" />
      <h2 className={partnerRuleHeadingClassName}>{children}</h2>
      <span aria-hidden className="h-px flex-1 bg-border-default" />
    </div>
  )
}

export function PartnersPyramid({
  analyticsPlacement,
}: {
  analyticsPlacement: PartnerPlacement
}) {
  const placementContext = usePartnerPlacementContext({
    orderStrategy: 'tier-rotated',
    surface: analyticsPlacement,
  })

  const groups = getPartnerTierGroupsForPlacement(
    allPartners.filter((partner) => partner.status === 'active'),
    placementContext,
  )

  // Running slot index across tiers, matching what PartnersGrid reports.
  let slotIndex = 0
  const tiers = groups.map((group) => ({
    tier: group.tier,
    partners: group.partners.map((partner) => ({
      partner,
      index: slotIndex++,
    })),
  }))

  return (
    <div className={`space-y-12 ${logoScaleClassName}`}>
      {tiers.map((row) => (
        <section key={row.tier}>
          {/* Same gap above the logos as `space-y-12` leaves below them. */}
          <div className="mb-12">
            <PartnerRuleHeading>
              {partnerTierLabels[row.tier]} Partners
            </PartnerRuleHeading>
          </div>
          <ul className="flex flex-wrap justify-center">
            {row.partners.map(({ partner, index }) => (
              <li key={partner.id} className={tierItem[row.tier]}>
                <PartnerPyramidLink
                  analyticsPlacement={analyticsPlacement}
                  placementContext={placementContext}
                  partner={partner}
                  index={index}
                >
                  <AreaLogo
                    id={partner.id}
                    image={partner.image}
                    name={partner.name}
                    tier={row.tier}
                  />
                </PartnerPyramidLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PartnerPyramidLink({
  analyticsPlacement,
  placementContext,
  partner,
  index,
  children,
}: {
  analyticsPlacement: PartnerPlacement
  placementContext: PartnerPlacementContext
  partner: Partner
  index: number
  children: React.ReactNode
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
      className="flex h-full cursor-pointer items-center justify-center rounded-lg corner-squircle px-[7%] opacity-90 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
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
