import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { DsPage, DsSection, Swatch } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/colors')({
  component: ColorsPage,
  head: () => ({
    meta: seo({
      title: 'Colors | TanStack Design System',
      description:
        'The TanStack color system, sourced from Figma — brand & neutral ramps and the semantic tokens components consume.',
    }),
  }),
})

const RAMPS = ['green', 'terracotta', 'blue', 'purple', 'amber', 'neutral']
const STEPS = [100, 200, 300, 400, 500]

const SEMANTIC_GROUPS: Array<{ title: string; tokens: Array<string> }> = [
  {
    title: 'Text',
    tokens: [
      'text-primary',
      'text-secondary',
      'text-muted',
      'text-accent',
      'text-disabled',
      'text-inverse',
      'text-success',
      'text-warning',
      'text-error',
      'text-info',
    ],
  },
  {
    title: 'Background',
    tokens: [
      'background-default',
      'background-surface',
      'background-elevated',
      'background-subtle',
      'background-inverse',
    ],
  },
  {
    title: 'Border',
    tokens: [
      'border-default',
      'border-strong',
      'border-subtle',
      'border-focus',
      'border-error',
      'border-success',
    ],
  },
  {
    title: 'Icon',
    tokens: [
      'icon-default',
      'icon-accent',
      'icon-muted',
      'icon-inverse',
      'icon-success',
      'icon-warning',
      'icon-error',
    ],
  },
  {
    title: 'Action',
    tokens: [
      'action-primary',
      'action-primary-hover',
      'action-primary-text',
      'action-secondary',
      'action-secondary-hover',
      'action-destructive',
      'action-disabled',
    ],
  },
  {
    title: 'Status',
    tokens: [
      'status-success',
      'status-success-bg',
      'status-warning',
      'status-warning-bg',
      'status-error',
      'status-error-bg',
      'status-info',
      'status-info-bg',
    ],
  },
  {
    title: 'Accent',
    tokens: [
      'accent-brand',
      'accent-warm',
      'accent-highlight',
      'accent-nature',
      'accent-creative',
    ],
  },
]

function ColorsPage() {
  return (
    <DsPage
      title="Colors"
      description="The TanStack color system, sourced from Figma. Brand & neutral ramps are the raw primitives; the semantic tokens below reference them and are what components should consume. These swatches respond to the theme — toggle light/dark to see both. (Replaces the legacy twine/gray palette.)"
    >
      <DsSection
        title="Brand & neutral ramps"
        description="The six primitive ramps (100 lightest → 500 darkest). Full ramps also live on the Palette page."
      >
        <div className="space-y-6">
          {RAMPS.map((ramp) => (
            <div key={ramp}>
              <div className="mb-2 text-ds-label-sm uppercase tracking-wider text-text-muted">
                {ramp}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {STEPS.map((step) => (
                  <Swatch key={step} token={`ds-${ramp}-${step}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {SEMANTIC_GROUPS.map((group) => (
        <DsSection key={group.title} title={group.title}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </DsSection>
      ))}
    </DsPage>
  )
}
