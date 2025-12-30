import * as React from 'react'
import { partners as allPartners, PartnerImage } from '~/utils/partners'

type PartnerItem = (typeof allPartners)[number]

type PartnersGridProps = {
  partnersList?: PartnerItem[]
}

export function PartnersGrid({ partnersList }: PartnersGridProps) {
  const items = (partnersList ?? allPartners).filter(
    (partner) => partner.status === 'active',
  )

  // Sort by score descending so larger partners come first
  const sortedItems = [...items].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-wrap justify-center items-stretch border border-gray-200 dark:border-gray-800 max-w-full">
      {sortedItems.map((partner) => {
        // Size the cell based on score
        const width = Math.max(Math.round(120 + 280 * partner.score), 150)

        return (
          <a
            key={partner.name}
            href={partner.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center p-6
              border-r border-b border-gray-200 dark:border-gray-800
              hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors duration-150 ease-out"
            style={{ width, flexGrow: partner.score }}
          >
            <PartnerImage config={partner.image} alt={partner.name} />
          </a>
        )
      })}
    </div>
  )
}
