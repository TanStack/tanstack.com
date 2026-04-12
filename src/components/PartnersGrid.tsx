import * as React from 'react'
import { partners as allPartners, PartnerImage } from '~/utils/partners'
import { Card } from '~/components/Card'
import { trackEvent, useTrackedImpression } from '~/utils/analytics'

type PartnerItem = (typeof allPartners)[number]

type PartnersGridProps = {
  analyticsPlacement?: string
  analyticsProperties?: Record<string, unknown>
  partnersList?: PartnerItem[]
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

  const width = Math.max(Math.round(120 + 280 * partner.score), 150)

  return (
    <a
      ref={ref}
      href={partner.href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center p-6
        border-r border-b border-gray-200 dark:border-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors duration-150 ease-out"
      style={{ width, flexGrow: partner.score }}
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
      <PartnerImage config={partner.image} alt={partner.name} />
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

  // Sort by score descending so larger partners come first
  const sortedItems = [...items].sort((a, b) => b.score - a.score)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap justify-center items-stretch -mr-px -mb-px">
        {sortedItems.map((partner, index) => (
          <PartnerGridItem
            key={partner.id}
            analyticsPlacement={analyticsPlacement}
            analyticsProperties={analyticsProperties}
            index={index}
            partner={partner}
          />
        ))}
      </div>
    </Card>
  )
}
