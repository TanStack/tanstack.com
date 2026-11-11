import * as React from 'react'
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
  eyebrowClassName,
  PartnerVariantLink,
  tierDotClassName,
  usePartnerVariantTiers,
  type PartnersVariantProps,
} from './shared'

// 6 — Stage. A compact logo index beside a stage. Hovering or focusing a logo
// puts that partner on the stage (logo, what it does, a short description);
// the stage opens on the first gold partner and keeps the last one previewed.
// Below `lg` there is no hover, so the stage is dropped and the index stands
// alone.

const indexSizing: PartnerLogoSizing = {
  goldMaxWidth: 144,
  goldMaxHeight: 36,
  tierStep: 0.75,
}

const stageSizing: PartnerLogoSizing = {
  goldMaxWidth: 240,
  goldMaxHeight: 64,
  tierStep: 1,
}

const tierIndex: Record<PartnerTier, { columns: string; cell: string }> = {
  gold: { columns: 'grid-cols-2 sm:grid-cols-4', cell: 'h-20' },
  silver: {
    columns: 'grid-cols-3 sm:grid-cols-5',
    cell: 'h-16',
  },
  bronze: {
    columns: 'grid-cols-3 sm:grid-cols-5',
    cell: 'h-14',
  },
}

export function PartnersVariant6Stage({
  analyticsPlacement,
}: PartnersVariantProps) {
  const { placementContext, tiers } = usePartnerVariantTiers(analyticsPlacement)
  const [previewId, setPreviewId] = React.useState<string>()

  const everyone = tiers.flatMap((row) =>
    row.partners.map(({ partner }) => ({ partner, tier: row.tier })),
  )
  const staged =
    everyone.find(({ partner }) => partner.id === previewId) ?? everyone.at(0)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-12">
      {staged && (
        <div className="hidden min-h-[400px] flex-col rounded-2xl corner-squircle border border-border-default bg-background-subtle p-8 lg:flex">
          <p className={`flex items-center gap-2 ${eyebrowClassName}`}>
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${tierDotClassName[staged.tier]}`}
            />
            {partnerTierLabels[staged.tier]} ·{' '}
            {partnerCategoryLabels[staged.partner.category]}
          </p>
          <div className="flex flex-1 items-center justify-center py-8">
            <PartnerTierLogo
              image={staged.partner.image}
              name=""
              tier="gold"
              sizing={stageSizing}
            />
          </div>
          <p className="font-ds-display text-ds-heading-4 text-text-primary">
            {staged.partner.tagline ?? staged.partner.name}
          </p>
          <p className="mt-2 line-clamp-3 text-ds-body-sm text-text-secondary">
            {staged.partner.llmDescription}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {tiers.map((row) => (
          <section key={row.tier}>
            <h4 className={`mb-2 ${eyebrowClassName}`}>
              {partnerTierLabels[row.tier]}
            </h4>
            <ul className={`-mx-2 grid gap-1 ${tierIndex[row.tier].columns}`}>
              {row.partners.map(({ partner, index }) => (
                <li key={partner.id}>
                  <PartnerVariantLink
                    analyticsPlacement={analyticsPlacement}
                    placementContext={placementContext}
                    partner={partner}
                    index={index}
                    onPreview={() => setPreviewId(partner.id)}
                    className={`flex items-center justify-center rounded-lg corner-squircle px-3 transition-colors duration-150 ease-out hover:bg-surface-state-hover ${tierIndex[row.tier].cell} ${
                      staged?.partner.id === partner.id
                        ? 'lg:bg-surface-state-hover'
                        : ''
                    }`}
                  >
                    <PartnerTierLogo
                      image={partner.image}
                      name={partner.name}
                      tier={row.tier}
                      sizing={indexSizing}
                    />
                  </PartnerVariantLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
