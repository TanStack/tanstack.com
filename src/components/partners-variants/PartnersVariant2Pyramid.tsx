import { partnerTierLabels, type PartnerTier } from '~/utils/partners'
import {
  PartnerTierLogo,
  type PartnerLogoSizing,
} from '~/components/ds/ui/PartnerTierLogo'
import {
  eyebrowClassName,
  PartnerVariantLink,
  usePartnerVariantTiers,
  type PartnersVariantProps,
} from './shared'

// 2 — Pyramid. Centered and borderless: whitespace and logo scale alone carry
// the hierarchy. Each tier is introduced by a hairline with its name set in it.

const sizing: PartnerLogoSizing = {
  goldMaxWidth: 208,
  goldMaxHeight: 52,
  tierStep: 0.75,
}

const tierItem: Record<PartnerTier, string> = {
  gold: 'h-24 basis-1/2 sm:basis-1/3 lg:basis-1/4',
  silver: 'h-20 basis-1/2 sm:basis-1/4 lg:basis-1/5',
  bronze: 'h-16 basis-1/3 sm:basis-1/5 lg:basis-1/6',
}

export function PartnersVariant2Pyramid({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)

  return (
    <div className="space-y-12">
      {tiers.map((row) => (
        <section key={row.tier}>
          <div className="mb-4 flex items-center gap-4">
            <span aria-hidden className="h-px flex-1 bg-border-default" />
            <h4 className={eyebrowClassName}>{partnerTierLabels[row.tier]}</h4>
            <span aria-hidden className="h-px flex-1 bg-border-default" />
          </div>
          <ul className="flex flex-wrap justify-center">
            {row.partners.map(({ partner, index }) => (
              <li key={partner.id} className={tierItem[row.tier]}>
                <PartnerVariantLink
                  analyticsPlacement={analyticsPlacement}
                  placementContext={placementContext}
                  partner={partner}
                  index={index}
                  className="flex h-full items-center justify-center rounded-lg corner-squircle px-5 opacity-90 transition-opacity duration-150 ease-out hover:opacity-100"
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
          </ul>
        </section>
      ))}
    </div>
  )
}
