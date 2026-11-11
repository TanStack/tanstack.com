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

// 1 — Ledger. An editorial table: the tier name sits in a left margin column,
// logos run in a hairline-ruled row beside it. No bands, no boxes.

const sizing: PartnerLogoSizing = {
  goldMaxWidth: 176,
  goldMaxHeight: 44,
  tierStep: 0.75,
}

const tierRow: Record<PartnerTier, { columns: string; cell: string }> = {
  gold: { columns: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4', cell: 'h-24' },
  silver: {
    columns: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5',
    cell: 'h-20',
  },
  bronze: {
    columns: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
    cell: 'h-16',
  },
}

export function PartnersVariant1Ledger({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)

  return (
    <div className="border-t border-border-default">
      {tiers.map((row) => (
        <section
          key={row.tier}
          className="grid gap-x-8 gap-y-3 border-b border-border-default py-6 md:grid-cols-[8rem_1fr] md:py-8"
        >
          <header className="flex items-center justify-between md:flex-col md:items-start md:justify-start md:gap-2 md:pt-3">
            <h4 className={`flex items-center gap-2 ${eyebrowClassName}`}>
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${tierDotClassName[row.tier]}`}
              />
              {partnerTierLabels[row.tier]}
            </h4>
            <span className="font-ds-mono text-ds-mono-xs text-text-muted tabular-nums">
              {String(row.partners.length).padStart(2, '0')}
            </span>
          </header>
          <ul className={`-mx-2 grid ${tierRow[row.tier].columns}`}>
            {row.partners.map(({ partner, index }) => (
              <li key={partner.id}>
                <PartnerVariantLink
                  analyticsPlacement={analyticsPlacement}
                  placementContext={placementContext}
                  partner={partner}
                  index={index}
                  className={`flex items-center justify-center rounded-lg corner-squircle px-4 transition-colors duration-150 ease-out hover:bg-surface-state-hover ${tierRow[row.tier].cell}`}
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
