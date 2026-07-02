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

const LIBRARY_COLORS = [
  'start',
  'router',
  'query',
  'table',
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
        <DsSection key={ramp} title={ramp[0].toUpperCase() + ramp.slice(1)}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {STEPS.map((step) => (
              <Swatch key={step} token={`ds-${ramp}-${step}`} />
            ))}
          </div>
        </DsSection>
      ))}

      <DsSection
        title="Library brand colors"
        description="Per-library accent colors used across TanStack sites."
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
