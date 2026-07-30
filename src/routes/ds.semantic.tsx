import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { DsPage, DsSection, Swatch } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/semantic')({
  component: SemanticTokensPage,
  head: () => ({
    meta: seo({
      title: 'Semantic Tokens | TanStack Design System',
      description:
        'Semantic color tokens (text, background, border, icon, action, status, accent) from Figma.',
    }),
  }),
})

const GROUPS: Array<{ title: string; tokens: Array<string> }> = [
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

function SemanticTokensPage() {
  return (
    <DsPage
      title="Semantic Tokens"
      description="Role-based tokens that components consume (e.g. action-primary, text-muted, border-default). Each references a primitive from the Palette, so re-pointing a semantic token — or editing its primitive — propagates everywhere it's used. This is the layer components should reference, not raw hexes."
    >
      {GROUPS.map((group) => (
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
