import { twMerge } from 'tailwind-merge'
import {
  PartnerImage,
  type PartnerImageConfig,
  type PartnerTier,
} from '~/utils/partners'

/* --------------------------------------------------------- sizing rubric -- */
// Gold is the source of truth. Each tier steps down by TIER_STEP (both width and
// height together), so a given logo renders exactly one step (×0.75) smaller
// than the tier above it. To resize the whole rail, change PARTNER_LOGO_GOLD
// only — never hand-set silver/bronze. See PartnerRail.rules.md.
export const PARTNER_LOGO_TIER_STEP = 0.75
export const PARTNER_LOGO_GOLD = { maxWidth: 170, maxHeight: 40 } // px

export type PartnerLogoSizing = {
  goldMaxWidth: number
  goldMaxHeight: number
  tierStep: number
}

export const DEFAULT_PARTNER_LOGO_SIZING: PartnerLogoSizing = {
  goldMaxWidth: PARTNER_LOGO_GOLD.maxWidth,
  goldMaxHeight: PARTNER_LOGO_GOLD.maxHeight,
  tierStep: PARTNER_LOGO_TIER_STEP,
}

const TIER_ORDER: Array<PartnerTier> = ['gold', 'silver', 'bronze']

/** Derived logo box for a tier: gold × tierStep ** (steps below gold). */
export function partnerLogoTierSize(
  tier: PartnerTier,
  sizing: PartnerLogoSizing = DEFAULT_PARTNER_LOGO_SIZING,
): { maxWidth: number; maxHeight: number } {
  const step = Math.max(0, TIER_ORDER.indexOf(tier))
  const factor = sizing.tierStep ** step
  return {
    maxWidth: Math.round(sizing.goldMaxWidth * factor),
    maxHeight: Math.round(sizing.goldMaxHeight * factor),
  }
}

/* ----------------------------------------------------------- component --- */
export function PartnerTierLogo({
  image,
  name,
  tier,
  sizing,
  scaleOverride,
  className,
}: {
  image: PartnerImageConfig
  name: string
  tier: PartnerTier
  /** Overrides the gold base / step — used by the workshop; production omits it. */
  sizing?: PartnerLogoSizing
  /** Workshop-only per-logo optical weight; production reads image.scale. */
  scaleOverride?: number
  /** Wrapper presentation (grayscale / idle opacity) supplied by the caller. */
  className?: string
}) {
  const { maxWidth, maxHeight } = partnerLogoTierSize(tier, sizing)
  const config: PartnerImageConfig =
    scaleOverride !== undefined ? { ...image, scale: scaleOverride } : image

  return (
    <div
      style={{ maxWidth }}
      className={twMerge(
        'mx-auto flex w-full items-center justify-center',
        className,
      )}
    >
      <PartnerImage
        className="w-full object-contain"
        style={{ maxHeight }}
        config={config}
        alt={name}
      />
    </div>
  )
}
