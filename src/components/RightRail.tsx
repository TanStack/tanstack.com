import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  PartnerImage,
  partnerTierFlares,
  partnerTierLabels,
  type Partner,
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
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'

type RailPartner = {
  category: Partner['category']
  id: string
  name: string
  href: string
  score: number
  tier?: PartnerTier
  image: Parameters<typeof PartnerImage>[0]['config']
}

type RightRailProps = {
  children: React.ReactNode
  className?: string
  breakpoint?: 'sm' | 'md'
  stickyOffset?: 'navbar' | 'docs-tabs'
}

export function RightRail({
  children,
  className,
  breakpoint = 'sm',
  stickyOffset = 'navbar',
}: RightRailProps) {
  const stickyTopClass =
    stickyOffset === 'docs-tabs'
      ? breakpoint === 'md'
        ? 'md:top-[calc(var(--navbar-height)+var(--docs-tabs-height,0px))]'
        : 'sm:top-[calc(var(--navbar-height)+var(--docs-tabs-height,0px))]'
      : breakpoint === 'md'
        ? 'md:top-[var(--navbar-height)]'
        : 'sm:top-[var(--navbar-height)]'
  const stickyMaxHeightClass =
    stickyOffset === 'docs-tabs'
      ? breakpoint === 'md'
        ? 'md:max-h-[calc(100dvh-var(--navbar-height)-var(--docs-tabs-height,0px))]'
        : 'sm:max-h-[calc(100dvh-var(--navbar-height)-var(--docs-tabs-height,0px))]'
      : breakpoint === 'md'
        ? 'md:max-h-[calc(100dvh-var(--navbar-height))]'
        : 'sm:max-h-[calc(100dvh-var(--navbar-height))]'
  const wrapperBreakpointClass =
    breakpoint === 'md'
      ? 'w-full md:w-[300px] shrink-0 md:sticky hidden md:block'
      : 'w-full sm:w-[300px] shrink-0 sm:sticky hidden sm:block'

  const innerBreakpointClass = breakpoint === 'md' ? 'md:sticky' : 'sm:sticky'

  return (
    <div className={twMerge(wrapperBreakpointClass, stickyTopClass, className)}>
      <div
        className={twMerge(
          innerBreakpointClass,
          stickyTopClass,
          stickyMaxHeightClass,
          'fade-y fade-size-y-sm ml-auto flex max-w-full flex-col gap-4 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0',
        )}
      >
        {children}
      </div>
    </div>
  )
}

const railTierLayout: Record<
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
    flexBasis: 'basis-full',
    minHeight: 'min-h-[72px]',
    logoMaxWidth: 'max-w-[180px]',
    logoMaxHeight: 'max-h-[40px]',
    padding: 'px-4 py-3',
  },
  silver: {
    flexBasis: 'basis-1/2',
    minHeight: 'min-h-[60px]',
    logoMaxWidth: 'max-w-[100px]',
    logoMaxHeight: 'max-h-[26px]',
    padding: 'px-2.5 py-2.5',
  },
  bronze: {
    flexBasis: 'basis-1/3',
    minHeight: 'min-h-[56px]',
    logoMaxWidth: 'max-w-[70px]',
    logoMaxHeight: 'max-h-[22px]',
    padding: 'px-2 py-2',
  },
}

// The tiered rail groups partners into centered tier sections (a hairline +
// icon + label header per tier). Logos scale down tier by tier — gold largest
// and one-up, silver medium and one-up, bronze smallest and two-up — and fade
// slightly, matching the design reference's spacing and relative scale.
const tieredTierLayout: Record<
  PartnerTier,
  {
    rowHeight: string
    logoMaxWidth: string
    logoMaxHeight: string
    perRow: 1 | 2
    idleOpacity: string
  }
> = {
  gold: {
    rowHeight: 'h-[80px]',
    logoMaxWidth: 'max-w-[210px]',
    logoMaxHeight: 'max-h-[46px]',
    perRow: 1,
    idleOpacity: '',
  },
  silver: {
    rowHeight: 'h-[62px]',
    logoMaxWidth: 'max-w-[145px]',
    logoMaxHeight: 'max-h-[30px]',
    perRow: 1,
    idleOpacity: 'opacity-80',
  },
  bronze: {
    rowHeight: 'h-[56px]',
    logoMaxWidth: 'max-w-[100px]',
    logoMaxHeight: 'max-h-[22px]',
    perRow: 2,
    idleOpacity: 'opacity-65',
  },
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

export function PartnersRail({
  analyticsPlacement,
  partners,
  title = 'Partners',
  titleTo = '/partners',
  layout = 'grid',
}: {
  analyticsPlacement: PartnerPlacement
  partners: Array<RailPartner>
  title?: string
  titleTo?: '/partners'
  /** `grid` (default) tiles logos in tier rows; `tiered` stacks centered tier
   *  sections whose logos scale down tier by tier (bronze is two-up). */
  layout?: 'grid' | 'tiered'
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

  if (layout === 'tiered') {
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
              className={
                tieredTierLayout[row.tier].perRow === 2
                  ? 'grid grid-cols-2'
                  : 'flex flex-col'
              }
            >
              {row.partners.map((partner) => {
                const index = slotIndex++
                return (
                  <PartnersRailItem
                    key={partner.id}
                    analyticsPlacement={analyticsPlacement}
                    index={index}
                    placementContext={placementContext}
                    partner={partner}
                    variant="tiered"
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="group/rail flex flex-col border-l border-gray-500/20 rounded-bl-lg overflow-hidden w-full">
      <div className="w-full flex gap-2 justify-between items-center border-b border-gray-500/20 px-3 py-2">
        <Link
          className="font-medium opacity-60 hover:opacity-100 text-xs"
          to={titleTo}
        >
          {title}
        </Link>
        <a
          href={PARTNER_INQUIRY_HREF}
          className="font-medium opacity-60 hover:opacity-100 text-xs hover:underline"
          onClick={() => trackPartnerInquiry(analyticsPlacement)}
        >
          Become a Partner
        </a>
      </div>
      {rowsByTier.map((row) => {
        const flare = partnerTierFlares[row.tier]
        return (
          <div
            key={row.tier}
            className="relative flex flex-wrap items-stretch w-full"
          >
            {/* Tier-colored top line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${flare.gradientStops}`}
            />
            {/* Absolute top-left tier label */}
            <div
              className={`absolute top-0.5 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-px rounded-full bg-white dark:bg-gray-900 z-10 ${flare.labelColor} text-[8px] uppercase tracking-[0.14em] font-semibold`}
            >
              <span className={flare.iconColor}>{flare.icon}</span>
              <span>{partnerTierLabels[row.tier]}</span>
            </div>
            {row.partners.map((partner) => {
              const index = slotIndex++
              return (
                <PartnersRailItem
                  key={partner.id}
                  analyticsPlacement={analyticsPlacement}
                  index={index}
                  placementContext={placementContext}
                  partner={partner}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function PartnersRailItem({
  analyticsPlacement,
  index,
  placementContext,
  partner,
  variant = 'grid',
}: {
  analyticsPlacement: PartnerPlacement
  index: number
  placementContext: PartnerPlacementContext
  partner: RailPartner
  variant?: 'grid' | 'tiered'
}) {
  const tier = partner.tier ?? 'bronze'
  // Tiered cells are borderless, fixed-height logo slots that fade by tier; grid
  // cells are borderless tiles that share edges within a tier row. Both read
  // logo bounds from their own concretely-typed config.
  const isTiered = variant === 'tiered'
  const grid = railTierLayout[tier]
  const tiered = tieredTierLayout[tier]
  const logoMaxWidth = isTiered ? tiered.logoMaxWidth : grid.logoMaxWidth
  // Netlify's wordmark is short for its width, so it reads smaller than its
  // gold peers; give it ~20px more height in the tiered rail (62px × the 1.25
  // image scale ≈ 78px, still within the 80px gold row).
  const logoMaxHeight = isTiered
    ? partner.id === 'netlify'
      ? 'max-h-[62px]'
      : tiered.logoMaxHeight
    : grid.logoMaxHeight
  const cellClass = isTiered
    ? twMerge('w-full px-2', tiered.rowHeight)
    : twMerge(
        'border-b border-r border-gray-500/20',
        grid.flexBasis,
        grid.minHeight,
        grid.padding,
      )
  // Lower tiers rest more muted and lift to full opacity/color on rail hover.
  const logoIdleClass = isTiered
    ? twMerge(tiered.idleOpacity, 'group-hover/rail:opacity-100')
    : ''
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
        'flex items-center justify-center overflow-hidden transition-colors duration-150 ease-out hover:bg-gray-500/10',
        cellClass,
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
      <div
        className={twMerge(
          'w-full flex items-center justify-center mx-auto grayscale brightness-90 group-hover/rail:grayscale-0 group-hover/rail:brightness-100 transition-[filter,opacity] duration-500 ease-out',
          logoMaxWidth,
          logoIdleClass,
        )}
      >
        <PartnerImage
          className={twMerge('w-full object-contain', logoMaxHeight)}
          config={partner.image}
          alt={partner.name}
        />
      </div>
    </a>
  )
}
