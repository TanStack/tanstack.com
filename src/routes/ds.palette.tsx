import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { DsPage, DsSection, Swatch } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/palette')({
  component: PalettePage,
  head: () => ({
    meta: seo({
      title: 'Palette | TanStack Design System',
      description: 'Primitive color ramps and library brand colors from Figma.',
    }),
  }),
})

const RAMPS = ['green', 'terracotta', 'blue', 'purple', 'amber', 'neutral']
const STEPS = [100, 200, 300, 400, 500]

/**
 * Neutral carries two half-steps the chromatic ramps do not need. Each is the
 * exact midpoint of its neighbours, added so the text scale has a legible
 * `secondary` in dark and a legible `muted` in light.
 */
const RAMP_STEPS: Record<string, Array<number>> = {
  neutral: [100, 150, 200, 300, 350, 400, 500],
}

const CATEGORY_COLORS = ['framework', 'data', 'ui', 'performance', 'tooling']

const LIBRARY_COLORS = [
  'start',
  'router',
  'query',
  'table',
  'charts',
  'db',
  'ai',
  'form',
  'virtual',
  'pacer',
  'hotkeys',
  'store',
  'devtools',
  'cli',
  'intent',
]

function PalettePage() {
  return (
    <DsPage
      title="Palette"
      description="The primitive color ramps sourced from Figma. These feed the semantic tokens — change a primitive here (in app.css) and every semantic token referencing it updates across the system. Click a swatch to copy its var() reference."
    >
      {RAMPS.map((ramp) => (
        <DsSection
          key={ramp}
          title={ramp[0].toUpperCase() + ramp.slice(1)}
          description={
            ramp === 'neutral'
              ? '150 and 350 are half-steps — the midpoints of 100/200 and 300/400 — carried only by this ramp so the text scale has a legible secondary in dark and a legible muted in light. Not yet in Figma.'
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {(RAMP_STEPS[ramp] ?? STEPS).map((step) => (
              <Swatch key={step} token={`ds-${ramp}-${step}`} />
            ))}
          </div>
        </DsSection>
      ))}

      <DsSection
        title="Neutral tint (cool)"
        description="A cool-toned neutral set, distinct from the warm neutral ramp. neutral-0 is pure white."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <Swatch token="ds-neutral-0" />
          <Swatch token="ds-neutral-tint-100" />
          <Swatch token="ds-neutral-tint-200" />
        </div>
      </DsSection>

      <DsSection
        title="Category colors"
        description="Libraries are grouped into five categories and inherit their category's color as their core brand color (ramp 400 in light, 300 in dark). These are the system-level source of truth for every library's brand color."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {CATEGORY_COLORS.map((category) => (
            <Swatch key={category} token={`category-${category}`} />
          ))}
        </div>
      </DsSection>

      <DsSection
        title="Library brand colors"
        description="Per-library tokens — now aliased to the library's category color above (so they collapse to the five category hues)."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
          {LIBRARY_COLORS.map((lib) => (
            <Swatch key={lib} token={`lib-${lib}`} />
          ))}
        </div>
      </DsSection>
    </DsPage>
  )
}
