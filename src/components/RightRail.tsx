import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { PartnerImage } from '~/utils/partners'
import { trackPostHogEvent, useTrackedImpression } from '~/utils/posthog'

type RailPartner = {
  id: string
  name: string
  href: string
  score: number
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
      ? 'md:sticky md:top-[var(--navbar-height)]'
      : 'sm:sticky sm:top-[var(--navbar-height)]'

  return (
    <div className={twMerge(wrapperBreakpointClass, className)}>
      <div
        className={twMerge(
          innerBreakpointClass,
          'ml-auto flex flex-col gap-4 pb-4 max-w-full overflow-hidden',
        )}
      >
        {children}
      </div>
    </div>
  )
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
  return (
    <div className="flex flex-wrap items-stretch border-l border-gray-500/20 rounded-bl-lg overflow-hidden w-full">
      <div className="w-full flex gap-2 justify-between border-b border-gray-500/20 px-3 py-2">
        <Link
          className="font-medium opacity-60 hover:opacity-100 text-xs"
          to={titleTo}
        >
          {title}
        </Link>
      </div>
      {partners.map((partner, index) => (
        <PartnersRailItem
          key={partner.id}
          analyticsPlacement={analyticsPlacement}
          analyticsProperties={analyticsProperties}
          index={index}
          partner={partner}
        />
      ))}
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
  const widthPercent = Math.round(partner.score * 100)
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
      className="flex items-center justify-center px-3 py-2 border-r border-b border-gray-500/20 hover:bg-gray-500/10 transition-colors duration-150 ease-out"
      style={{
        flexBasis: `${widthPercent}%`,
        flexGrow: 1,
        flexShrink: 0,
      }}
      onClick={() => {
        trackPostHogEvent('partner_click', {
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
        style={{
          width: Math.max(60 + Math.round(140 * partner.score), 70),
        }}
      >
        <PartnerImage config={partner.image} alt={partner.name} />
      </div>
    </a>
  )
}
