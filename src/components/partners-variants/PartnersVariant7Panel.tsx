import { partnerTierLabels, type PartnerTier } from '~/utils/partners'
import {
  PartnerTierLogo,
  type PartnerLogoSizing,
} from '~/components/ds/ui/PartnerTierLogo'
import {
  eyebrowClassName,
  PartnerVariantLink,
  tierDotClassName,
  usePartnerVariantTiers,
  type PartnersVariantProps,
} from './shared'

// 7 — Panel. The whole programme on one grounded surface, about a third the
// height of the current grid: gold across the top, silver and bronze sharing
// the row beneath.

const sizing: PartnerLogoSizing = {
  goldMaxWidth: 176,
  goldMaxHeight: 44,
  tierStep: 0.75,
}

const tierBlock: Record<
  PartnerTier,
  { block: string; columns: string; cell: string }
> = {
  gold: {
    block: 'lg:col-span-9',
    columns: 'grid-cols-2 sm:grid-cols-4',
    cell: 'h-24',
  },
  silver: {
    block: 'border-t border-border-default lg:col-span-6',
    columns: 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-3',
    cell: 'h-16',
  },
  bronze: {
    block: 'border-t border-border-default lg:col-span-3 lg:border-l',
    columns: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-2',
    cell: 'h-16',
  },
}

export function PartnersVariant7Panel({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)

  return (
    <div className="grid overflow-hidden rounded-2xl corner-squircle border border-border-default bg-background-subtle lg:grid-cols-9">
      {tiers.map((row) => (
        <section
          key={row.tier}
          className={`p-5 sm:p-8 ${tierBlock[row.tier].block}`}
        >
          <h4 className={`mb-3 flex items-center gap-2 ${eyebrowClassName}`}>
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${tierDotClassName[row.tier]}`}
            />
            {partnerTierLabels[row.tier]}
          </h4>
          <ul className={`-mx-2 grid gap-1 ${tierBlock[row.tier].columns}`}>
            {row.partners.map(({ partner, index }) => (
              <li key={partner.id}>
                <PartnerVariantLink
                  analyticsPlacement={analyticsPlacement}
                  placementContext={placementContext}
                  partner={partner}
                  index={index}
                  className={`flex items-center justify-center rounded-lg corner-squircle px-2 transition-colors duration-150 sm:px-4 ease-out hover:bg-surface-state-hover ${tierBlock[row.tier].cell}`}
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
