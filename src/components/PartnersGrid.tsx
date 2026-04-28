import * as React from 'react'
import {
  partners as allPartners,
  PartnerImage,
  partnerTierFlares,
  partnerTierLabels,
  partnerTierOrder,
  type PartnerTier,
} from '~/utils/partners'
import { Card } from '~/components/Card'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'

type PartnerItem = (typeof allPartners)[number]

type PartnersGridProps = {
  analyticsPlacement?: string
  analyticsProperties?: Record<string, unknown>
  partnersList?: PartnerItem[]
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
    flexBasis: 'basis-full sm:basis-1/2',
    minHeight: 'min-h-[220px]',
    logoMaxWidth: 'max-w-[400px]',
    logoMaxHeight: 'max-h-[120px]',
    padding: 'p-12',
  },
  silver: {
    flexBasis: 'basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4',
    minHeight: 'min-h-[130px]',
    logoMaxWidth: 'max-w-[180px]',
    logoMaxHeight: 'max-h-[56px]',
    padding: 'p-6',
  },
  bronze: {
    flexBasis: 'basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6',
    minHeight: 'min-h-[100px]',
    logoMaxWidth: 'max-w-[110px]',
    logoMaxHeight: 'max-h-[36px]',
    padding: 'p-4',
  },
}

function PartnerGridItem({
  analyticsPlacement,
  analyticsProperties,
  index,
  partner,
}: {
  analyticsPlacement: string
  analyticsProperties?: Record<string, unknown>
  index: number
  partner: PartnerItem
}) {
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

  const layout = tierLayout[partner.tier ?? 'bronze']

  return (
    <a
      ref={ref}
      href={partner.href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center
        border-r border-b border-gray-200 dark:border-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors duration-150 ease-out
        ${layout.flexBasis} ${layout.minHeight} ${layout.padding}`}
      onClick={() => {
        trackEvent('partner_card_clicked', {
          partner_id: partner.id,
          partner_name: partner.name,
          destination_host: new URL(partner.href).host,
          placement: analyticsPlacement,
          slot_index: index,
          ...analyticsProperties,
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
  analyticsPlacement = 'partners_grid',
  analyticsProperties,
  partnersList,
}: PartnersGridProps) {
  const items = (partnersList ?? allPartners).filter(
    (partner) => partner.status === 'active',
  )

  const tiers: Array<PartnerTier> = ['gold', 'silver', 'bronze']

  const tiersWithPartners = tiers
    .map((tier) => ({
      tier,
      partners: items
        .filter((partner) => (partner.tier ?? 'bronze') === tier)
        .sort((a, b) => b.score - a.score),
    }))
    .filter((row) => row.partners.length > 0)
    .sort((a, b) => partnerTierOrder[a.tier] - partnerTierOrder[b.tier])

  let slotIndex = 0

  return (
    <div className="flex flex-col gap-3">
      {tiersWithPartners.map((row) => {
        const flare = partnerTierFlares[row.tier]
        return (
        <Card
          key={row.tier}
          className={`overflow-hidden rounded-none rounded-l-sm rounded-r-2xl bg-gradient-to-b ${flare.gradientStops}`}
        >
          <div className="ml-1.5 bg-white dark:bg-gray-900">
            <div className="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <span className={flare.iconColor}>{flare.icon}</span>
              <span
                className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${flare.labelColor}`}
              >
                {partnerTierLabels[row.tier]}
              </span>
            </div>
            <div className="flex flex-wrap items-stretch -mr-px -mb-px">
              {row.partners.map((partner) => {
                const index = slotIndex++
                return (
                  <PartnerGridItem
                    key={partner.id}
                    analyticsPlacement={analyticsPlacement}
                    analyticsProperties={analyticsProperties}
                    index={index}
                    partner={partner}
                  />
                )
              })}
            </div>
          </div>
        </Card>
        )
      })}
    </div>
  )
}
