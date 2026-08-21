import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'
import { PartnerRail } from '~/components/ds/ui/PartnerRail'
import {
  PARTNER_LOGO_GOLD,
  PARTNER_LOGO_TIER_STEP,
  partnerLogoTierSize,
  type PartnerLogoSizing,
} from '~/components/ds/ui/PartnerTierLogo'
import { partners, type PartnerTier } from '~/utils/partners'

export const Route = createFileRoute('/ds/partner-rail')({
  component: PartnerRailPage,
  head: () => ({
    meta: seo({
      title: 'Partner Rail | TanStack Design System',
      description:
        'The tiered partner rail and its logo-sizing rubric — gold is the source of truth, silver and bronze derive by a 25% step.',
    }),
  }),
})

const activePartners = partners.filter((p) => p.status === 'active')
const TIERS: Array<PartnerTier> = ['gold', 'silver', 'bronze']

function PartnerRailPage() {
  // Workshop state — see PartnerRailWorkshop. Once the values are balanced, bake
  // them into PartnerTierLogo's constants + each partner's image.scale, then
  // delete the workshop panel and PartnerRail's sizing/scaleOverrides props.
  const [sizing, setSizing] = React.useState<PartnerLogoSizing>({
    goldMaxWidth: PARTNER_LOGO_GOLD.maxWidth,
    goldMaxHeight: PARTNER_LOGO_GOLD.maxHeight,
    tierStep: PARTNER_LOGO_TIER_STEP,
  })
  const [scales, setScales] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(activePartners.map((p) => [p.id, p.image.scale ?? 1])),
  )
  const [rowGaps, setRowGaps] = React.useState<Record<PartnerTier, number>>({
    gold: 0,
    silver: 0,
    bronze: 0,
  })

  return (
    <DsPage
      title="Partner Rail"
      description="The tiered partner rail: partners grouped into centered tier sections, each logo sized by a shared rubric. Gold is the source of truth; silver and bronze derive by a 25% step. Sources: src/components/ds/ui/PartnerRail.tsx, PartnerTierLogo.tsx, PartnerRail.rules.md."
    >
      <DsSection
        title="Rail"
        description="The live component (as it appears in the blog's right gutter). Hover to lift the logos from grayscale to color. Drive the sizes with the workshop controls below."
      >
        <ComponentPreview
          className="block p-0"
          code={`<PartnerRail analyticsPlacement="blog_rail" partners={activePartners} />`}
        >
          <div className="grid w-full lg:grid-cols-2">
            <RailMode
              mode="light"
              sizing={sizing}
              scales={scales}
              rowGaps={rowGaps}
            />
            <RailMode
              mode="dark"
              sizing={sizing}
              scales={scales}
              rowGaps={rowGaps}
            />
          </div>
        </ComponentPreview>
        <PartnerRailWorkshop
          sizing={sizing}
          setSizing={setSizing}
          scales={scales}
          setScales={setScales}
          rowGaps={rowGaps}
          setRowGaps={setRowGaps}
        />
      </DsSection>

      <DsSection
        title="Tiers"
        description="Gold is the only knob. silver = gold × 0.75, bronze = gold × 0.75² (0.5625). The dashed boxes are the derived per-tier logo bounds at the current gold base."
      >
        <ComponentPreview
          className="block"
          code={`partnerLogoTierSize('gold')   // { maxWidth, maxHeight }
partnerLogoTierSize('silver') // gold × 0.75
partnerLogoTierSize('bronze') // gold × 0.5625`}
        >
          <div className="flex flex-wrap items-end gap-8">
            {TIERS.map((tier) => {
              const { maxWidth, maxHeight } = partnerLogoTierSize(tier, sizing)
              return (
                <div key={tier} className="flex flex-col items-center gap-2">
                  <div
                    className="rounded border border-dashed border-border-default bg-background-subtle"
                    style={{ width: maxWidth, height: maxHeight }}
                  />
                  <div className="text-xs text-text-secondary">
                    {tier}: {maxWidth}×{maxHeight}
                  </div>
                </div>
              )
            })}
          </div>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Per-logo scale"
        description="The tier box sets the size; the global per-partner `scale` (in partners.tsx) is the optical-weight knob layered on top. Use < 1 for logos that read heavy (dense/icon-forward marks), > 1 for logos that read light (thin or padded wordmarks), roughly 0.7–1.3. `scale` is global, so it also affects the partners page and other placements."
      >
        <ComponentPreview
          className="block"
          code={`// in src/utils/partners.tsx
image: { light, dark, scale: 1.25 } // Netlify: thin wordmark, sized up
image: { light, dark, scale: 0.7 }  // Unkey: compact mark, sized down`}
        >
          <p className="max-w-prose text-sm text-text-secondary">
            Tune each logo's <code>scale</code> with the workshop sliders above
            until every logo in a tier reads at a consistent visual size against
            a reference, then copy the values from the config output into{' '}
            <code>partners.tsx</code>.
          </p>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}

function RailMode({
  mode,
  sizing,
  scales,
  rowGaps,
}: {
  mode: 'light' | 'dark'
  sizing: PartnerLogoSizing
  scales: Record<string, number>
  rowGaps: Record<PartnerTier, number>
}) {
  return (
    <div
      // `dark` (not just `ds-mode-dark`) so PartnerImage's Tailwind `dark:`
      // logo swap fires locally — otherwise the dark panel shows the light,
      // dark-ink logos on a dark background (i.e. nothing visible).
      className={`${mode === 'dark' ? 'dark ' : ''}ds-mode-${mode} relative flex justify-center bg-background-default px-6 pb-8 pt-10 text-text-primary ${
        mode === 'dark'
          ? 'border-t border-white/10 lg:border-l lg:border-t-0'
          : ''
      }`}
    >
      <div className="absolute left-6 top-4 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
        {mode}
      </div>
      <div className="w-[300px]">
        <PartnerRail
          analyticsPlacement="blog_rail"
          partners={activePartners}
          sizing={sizing}
          scaleOverrides={scales}
          rowGaps={rowGaps}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * TEMPORARY workshop controls — delete once the sizing is balanced.
 * Deprecation: bake the config output into PartnerTierLogo's constants and each
 * partner's `image.scale`, then remove this panel and PartnerRail's
 * `sizing` / `scaleOverrides` props.
 * ------------------------------------------------------------------------- */
function PartnerRailWorkshop({
  sizing,
  setSizing,
  scales,
  setScales,
  rowGaps,
  setRowGaps,
}: {
  sizing: PartnerLogoSizing
  setSizing: React.Dispatch<React.SetStateAction<PartnerLogoSizing>>
  scales: Record<string, number>
  setScales: React.Dispatch<React.SetStateAction<Record<string, number>>>
  rowGaps: Record<PartnerTier, number>
  setRowGaps: React.Dispatch<React.SetStateAction<Record<PartnerTier, number>>>
}) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        Workshop controls · temporary — remove once balanced
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider
          label={`Gold max-width · ${sizing.goldMaxWidth}px`}
          min={60}
          max={260}
          step={1}
          value={sizing.goldMaxWidth}
          onChange={(v) => setSizing((s) => ({ ...s, goldMaxWidth: v }))}
        />
        <Slider
          label={`Gold max-height · ${sizing.goldMaxHeight}px`}
          min={16}
          max={80}
          step={1}
          value={sizing.goldMaxHeight}
          onChange={(v) => setSizing((s) => ({ ...s, goldMaxHeight: v }))}
        />
        <Slider
          label={`Tier step · ${sizing.tierStep.toFixed(2)}`}
          min={0.5}
          max={0.95}
          step={0.01}
          value={sizing.tierStep}
          onChange={(v) => setSizing((s) => ({ ...s, tierStep: v }))}
        />
        {TIERS.map((tier) => (
          <Slider
            key={tier}
            label={`${tier} spacing · ${rowGaps[tier]}px`}
            min={0}
            max={48}
            step={1}
            value={rowGaps[tier]}
            onChange={(v) => setRowGaps((g) => ({ ...g, [tier]: v }))}
          />
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Per-logo scale
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activePartners.map((p) => (
            <Slider
              key={p.id}
              label={`${p.name} · ${(scales[p.id] ?? 1).toFixed(2)}`}
              min={0.5}
              max={1.6}
              step={0.01}
              value={scales[p.id] ?? 1}
              onChange={(v) => setScales((s) => ({ ...s, [p.id]: v }))}
            />
          ))}
        </div>
      </div>
      <ConfigOutput sizing={sizing} scales={scales} rowGaps={rowGaps} />
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-text-secondary">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="w-full accent-amber-500"
      />
    </label>
  )
}

function ConfigOutput({
  sizing,
  scales,
  rowGaps,
}: {
  sizing: PartnerLogoSizing
  scales: Record<string, number>
  rowGaps: Record<PartnerTier, number>
}) {
  const scaleLines = activePartners
    .filter((p) => Math.abs((scales[p.id] ?? 1) - 1) > 0.001)
    .map((p) => `  ${p.id}: scale ${(scales[p.id] ?? 1).toFixed(2)}`)
    .join('\n')
  const text = `PARTNER_LOGO_GOLD = { maxWidth: ${sizing.goldMaxWidth}, maxHeight: ${sizing.goldMaxHeight} }
PARTNER_LOGO_TIER_STEP = ${sizing.tierStep.toFixed(2)}
row gap per tier = gold ${rowGaps.gold}px · silver ${rowGaps.silver}px · bronze ${rowGaps.bronze}px

// image.scale per partner (paste into partners.tsx):
${scaleLines || '  (all default 1.0)'}`
  return (
    <pre className="mt-4 overflow-x-auto rounded bg-background-subtle p-3 text-xs text-text-secondary">
      {text}
    </pre>
  )
}
