import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  PartnerImage,
  partnerTierFlares,
  partnerTierLabels,
  partnerTierOrder,
  type PartnerTier,
} from '~/utils/partners'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'

type RailPartner = {
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
}

export function RightRail({
  children,
  className,
  breakpoint = 'sm',
}: RightRailProps) {
  const wrapperBreakpointClass =
    breakpoint === 'md'
      ? 'w-full md:w-[300px] shrink-0 md:sticky md:top-[var(--navbar-height)] hidden md:block'
      : 'w-full sm:w-[300px] shrink-0 sm:sticky sm:top-[var(--navbar-height)] hidden sm:block'

  const innerBreakpointClass =
    breakpoint === 'md'
      ? 'md:sticky md:top-[var(--navbar-height)] md:max-h-[calc(100dvh-var(--navbar-height))]'
      : 'sm:sticky sm:top-[var(--navbar-height)] sm:max-h-[calc(100dvh-var(--navbar-height))]'

  return (
    <div className={twMerge(wrapperBreakpointClass, className)}>
      <div
        className={twMerge(
          innerBreakpointClass,
          'ml-auto flex flex-col gap-4 pb-4 max-w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0',
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

export function PartnersRail({
  analyticsPlacement = 'partners_rail',
  analyticsProperties,
  partners,
  title = 'Partners',
  titleTo = '/partners',
}: {
  analyticsPlacement?: string
  analyticsProperties?: Record<string, unknown>
  partners: Array<RailPartner>
  title?: string
  titleTo?: '/partners'
}) {
  const tiers: Array<PartnerTier> = ['gold', 'silver', 'bronze']

  const rowsByTier = tiers
    .map((tier) => ({
      tier,
      partners: partners
        .filter((partner) => (partner.tier ?? 'bronze') === tier)
        .sort((a, b) => b.score - a.score),
    }))
    .filter((row) => row.partners.length > 0)
    .sort((a, b) => partnerTierOrder[a.tier] - partnerTierOrder[b.tier])

  let slotIndex = 0

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
          href="https://docs.google.com/document/d/1Hg2MzY2TU6U3hFEZ3MLe2oEOM3JS4-eByti3kdJU3I8"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium opacity-60 hover:opacity-100 text-xs hover:underline"
          onClick={() => {
            trackEvent('become_partner_clicked', {
              placement: analyticsPlacement,
              ...analyticsProperties,
            })
          }}
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
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${flare.gradientStops}`}
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
                  analyticsProperties={analyticsProperties}
                  index={index}
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
  analyticsProperties,
  index,
  partner,
}: {
  analyticsPlacement: string
  analyticsProperties?: Record<string, unknown>
  index: number
  partner: RailPartner
}) {
  const layout = railTierLayout[partner.tier ?? 'bronze']
  const ref = useTrackedImpression<HTMLAnchorElement>({
    event: 'partner_impression',
    properties: {
      partner_id: partner.id,
      partner_name: partner.name,
      placement: analyticsPlacement,
      slot_index: index,
      ...analyticsProperties,
    },
  })

  return (
    <a
      ref={ref}
      href={partner.href}
      target="_blank"
      rel="noreferrer"
      className={twMerge(
        'flex items-center justify-center overflow-hidden border-r border-b border-gray-500/20 hover:bg-gray-500/10 transition-colors duration-150 ease-out',
        layout.flexBasis,
        layout.minHeight,
        layout.padding,
      )}
      onClick={() => {
        trackEvent('partner_click', {
          partner_id: partner.id,
          partner_name: partner.name,
          placement: analyticsPlacement,
          slot_index: index,
          destination_host: new URL(partner.href).host,
          ...analyticsProperties,
        })
      }}
    >
      <div
        className={twMerge(
          'w-full flex items-center justify-center mx-auto grayscale brightness-90 group-hover/rail:grayscale-0 group-hover/rail:brightness-100 transition-[filter] duration-500 ease-out',
          layout.logoMaxWidth,
        )}
      >
        <PartnerImage
          className={twMerge('w-full object-contain', layout.logoMaxHeight)}
          config={partner.image}
          alt={partner.name}
        />
      </div>
    </a>
  )
}
