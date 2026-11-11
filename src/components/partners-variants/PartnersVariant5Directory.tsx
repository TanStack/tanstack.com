import { ArrowUpRightIcon } from '@phosphor-icons/react/ArrowUpRight'
import { partnerCategoryLabels, partnerTierLabels } from '~/utils/partners'
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

// 5 — Directory. A typographic index: every partner is a row that says who it
// is and what it does. Gold rows run full width; silver and bronze share a
// tighter two-column list beneath.

const sizing: PartnerLogoSizing = {
  goldMaxWidth: 152,
  goldMaxHeight: 36,
  tierStep: 0.75,
}

export function PartnersVariant5Directory({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)
  const gold = tiers.find((row) => row.tier === 'gold')
  const rest = tiers.filter((row) => row.tier !== 'gold')

  return (
    <div className="space-y-10">
      {gold && (
        <section>
          <h4 className={`mb-3 flex items-center gap-2 ${eyebrowClassName}`}>
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${tierDotClassName.gold}`}
            />
            {partnerTierLabels.gold}
          </h4>
          <ul className="border-t border-border-default">
            {gold.partners.map(({ partner, index }) => (
              <li key={partner.id} className="border-b border-border-default">
                <PartnerVariantLink
                  analyticsPlacement={analyticsPlacement}
                  placementContext={placementContext}
                  partner={partner}
                  index={index}
                  className="group/row -mx-3 flex items-center gap-4 rounded-lg corner-squircle px-3 py-5 transition-colors duration-150 ease-out hover:bg-surface-state-hover sm:gap-8"
                >
                  <span className="flex h-10 w-32 shrink-0 items-center sm:w-44">
                    <PartnerTierLogo
                      image={partner.image}
                      name={partner.name}
                      tier="gold"
                      sizing={sizing}
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-ds-body-md text-text-primary">
                    {partner.tagline ?? partner.name}
                  </span>
                  <span className="hidden font-ds-mono text-ds-mono-xs text-text-muted md:block">
                    {partnerCategoryLabels[partner.category]}
                  </span>
                  <ArrowUpRightIcon
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-icon-muted transition-colors duration-150 ease-out group-hover/row:text-text-primary"
                  />
                </PartnerVariantLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {rest.map((row) => (
            <section key={row.tier}>
              <h4
                className={`mb-3 flex items-center gap-2 ${eyebrowClassName}`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${tierDotClassName[row.tier]}`}
                />
                {partnerTierLabels[row.tier]}
              </h4>
              <ul className="border-t border-border-default">
                {row.partners.map(({ partner, index }) => (
                  <li
                    key={partner.id}
                    className="border-b border-border-default"
                  >
                    <PartnerVariantLink
                      analyticsPlacement={analyticsPlacement}
                      placementContext={placementContext}
                      partner={partner}
                      index={index}
                      className="group/row -mx-3 flex items-center gap-4 rounded-lg corner-squircle px-3 py-3 transition-colors duration-150 ease-out hover:bg-surface-state-hover"
                    >
                      <span className="flex h-8 w-32 shrink-0 items-center px-2 sm:w-36">
                        <PartnerTierLogo
                          image={partner.image}
                          name={partner.name}
                          tier={row.tier}
                          sizing={sizing}
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ds-body-sm text-text-secondary">
                        {partner.tagline ??
                          partnerCategoryLabels[partner.category]}
                      </span>
                      <ArrowUpRightIcon
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-icon-muted transition-colors duration-150 ease-out group-hover/row:text-text-primary"
                      />
                    </PartnerVariantLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
