import {
  partnerCategoryLabels,
  partnerTierLabels,
  type PartnerTier,
} from '~/utils/partners'
import {
  PartnerTierLogo,
  type PartnerLogoSizing,
} from '~/components/ds/ui/PartnerTierLogo'
import {
  PartnerVariantLink,
  usePartnerVariantTiers,
  type PartnersVariantProps,
} from './shared'

// 4 — Wall. One continuous hairline wall. Gold rests in full colour; silver and
// bronze rest in monochrome and lift to colour on hover or focus, when the cell
// also says what the partner does. The tier name is a small corner mark.

const sizing: PartnerLogoSizing = {
  goldMaxWidth: 192,
  goldMaxHeight: 48,
  tierStep: 0.75,
}

const tierCell: Record<PartnerTier, { cell: string; logo: string }> = {
  gold: { cell: 'h-36 basis-1/2 lg:basis-1/4', logo: '' },
  silver: {
    cell: 'h-28 basis-1/2 sm:basis-1/3 lg:basis-1/5',
    logo: 'opacity-60 grayscale group-hover/cell:opacity-100 group-hover/cell:grayscale-0 group-focus-visible/cell:opacity-100 group-focus-visible/cell:grayscale-0',
  },
  bronze: {
    cell: 'h-24 basis-1/2 sm:basis-1/4',
    logo: 'opacity-60 grayscale group-hover/cell:opacity-100 group-hover/cell:grayscale-0 group-focus-visible/cell:opacity-100 group-focus-visible/cell:grayscale-0',
  },
}

export function PartnersVariant4Wall({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)

  return (
    <div className="overflow-hidden rounded-2xl corner-squircle border border-border-default">
      {tiers.map((row) => (
        <ul key={row.tier} className="-mr-px -mb-px flex flex-wrap">
          {row.partners.map(({ partner, index }, position) => (
            <li
              key={partner.id}
              className={`grow border-r border-b border-border-default ${tierCell[row.tier].cell}`}
            >
              <PartnerVariantLink
                analyticsPlacement={analyticsPlacement}
                placementContext={placementContext}
                partner={partner}
                index={index}
                className="group/cell relative flex h-full items-center justify-center px-6 ring-inset transition-colors duration-150 ease-out hover:bg-background-subtle"
              >
                {position === 0 && (
                  <span className="absolute top-3 left-3.5 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted">
                    {partnerTierLabels[row.tier]}
                  </span>
                )}
                <PartnerTierLogo
                  image={partner.image}
                  name={partner.name}
                  tier={row.tier}
                  sizing={sizing}
                  className={`transition-[opacity,filter] duration-200 ease-out ${tierCell[row.tier].logo}`}
                />
                <span className="pointer-events-none absolute inset-x-3 bottom-2.5 truncate text-center text-ds-body-xs text-text-muted opacity-0 transition-opacity duration-200 ease-out group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100">
                  {partner.tagline ?? partnerCategoryLabels[partner.category]}
                </span>
              </PartnerVariantLink>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
