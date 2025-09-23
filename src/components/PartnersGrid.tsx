import * as React from 'react'
import { partners as allPartners } from '~/utils/partners'

type PartnerItem = (typeof allPartners)[number]

type PartnersGridProps = {
  partnersList?: PartnerItem[]
}

export function PartnersGrid({ partnersList }: PartnersGridProps) {
  const items = (partnersList ?? allPartners).filter(
    (partner) => partner.status === 'active'
  )

  return (
    <div className={`flex flex-wrap gap-6 justify-center relative max-w-full`}>
      {items.map((partner) => {
        return (
          <a
            key={partner.name}
            href={partner.href}
            target="_blank"
            rel="noreferrer"
            className="bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-black/40 dark:shadow-none
              flex grow-1 justify-center p-8 hover:scale-[1.05] transition-all duration-100 ease-out max-w-full"
          >
            <div
              className="z-0 row-start-1 col-start-1 flex items-center justify-center transition-all duration-200 max-w-full"
              style={{
                width: Math.max(Math.round(100 + 300 * partner.score), 150),
              }}
            >
              {partner.homepageImg}
            </div>
          </a>
        )
      })}
    </div>
  )
}
