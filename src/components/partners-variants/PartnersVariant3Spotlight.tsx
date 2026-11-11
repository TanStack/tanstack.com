import * as React from 'react'
import { ArrowUpRightIcon } from '@phosphor-icons/react/ArrowUpRight'
import { partnerCategoryLabels, partnerTierLabels } from '~/utils/partners'
import {
  PartnerTierLogo,
  type PartnerLogoSizing,
} from '~/components/ds/ui/PartnerTierLogo'
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'
import {
  eyebrowClassName,
  PartnerVariantLink,
  usePartnerVariantTiers,
  type PartnersVariantProps,
} from './shared'

// 3 — Spotlight. Gold earns prominence through content, not size: each gold
// partner gets a card saying what it does. Silver and bronze follow as one
// quiet flowing strip.

const sizing: PartnerLogoSizing = {
  goldMaxWidth: 168,
  goldMaxHeight: 40,
  tierStep: 0.75,
}

export function PartnersVariant3Spotlight({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)
  const gold = tiers.find((row) => row.tier === 'gold')
  const rest = tiers.filter((row) => row.tier !== 'gold')

  return (
    <div className="space-y-10">
      {gold && (
        <section>
          <h4 className={`mb-4 ${eyebrowClassName}`}>
            {partnerTierLabels.gold} partners
          </h4>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gold.partners.map(({ partner, index }) => (
              <li key={partner.id}>
                <PartnerVariantLink
                  analyticsPlacement={analyticsPlacement}
                  placementContext={placementContext}
                  partner={partner}
                  index={index}
                  className="group/card flex h-full flex-col rounded-xl corner-squircle border border-border-default bg-background-subtle p-5 transition-colors duration-150 ease-out hover:border-border-strong"
                >
                  <div className="flex h-16 items-center">
                    <PartnerTierLogo
                      image={partner.image}
                      name={partner.name}
                      tier="gold"
                      sizing={sizing}
                    />
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-3 border-t border-border-subtle pt-4">
                    <p className="text-ds-body-sm text-text-secondary">
                      {partner.tagline ??
                        partnerCategoryLabels[partner.category]}
                    </p>
                    <ArrowUpRightIcon
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-icon-muted transition-colors duration-150 ease-out group-hover/card:text-text-primary"
                    />
                  </div>
                </PartnerVariantLink>
              </li>
            ))}
            <li>
              <a
                href={PARTNER_INQUIRY_HREF}
                onClick={() => trackPartnerInquiry(analyticsPlacement)}
                className="flex h-full min-h-32 flex-col justify-end rounded-xl corner-squircle border border-dashed border-border-default p-5 text-ds-body-sm text-text-muted transition-colors duration-150 ease-out hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                Become a partner
              </a>
            </li>
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-border-default pt-8">
          {rest.map((row) => (
            <React.Fragment key={row.tier}>
              <li
                className={`w-full pt-2 first:pt-0 lg:w-16 lg:pt-0 ${eyebrowClassName}`}
              >
                {partnerTierLabels[row.tier]}
              </li>
              {row.partners.map(({ partner, index }) => (
                <li key={partner.id}>
                  <PartnerVariantLink
                    analyticsPlacement={analyticsPlacement}
                    placementContext={placementContext}
                    partner={partner}
                    index={index}
                    className="flex h-14 w-32 items-center justify-center rounded-lg corner-squircle px-3 transition-colors duration-150 ease-out hover:bg-surface-state-hover"
                  >
                    <PartnerTierLogo
                      image={partner.image}
                      name={partner.name}
                      tier={row.tier}
                      sizing={sizing}
                    />
                  </PartnerVariantLink>
                </li>
              ))}
              <li aria-hidden className="hidden h-0 basis-full lg:block" />
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}
