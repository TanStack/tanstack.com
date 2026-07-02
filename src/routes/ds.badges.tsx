import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Badge } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/badges')({
  component: BadgesPage,
  head: () => ({
    meta: seo({
      title: 'Badges | TanStack Design System',
      description: 'The Badge component — status and label variants.',
    }),
  }),
})

const VARIANTS = [
  'default',
  'success',
  'warning',
  'error',
  'info',
  'purple',
  'teal',
  'orange',
] as const

function BadgesPage() {
  return (
    <DsPage
      title="Badges"
      description="Small, rounded status labels. Source: src/ui/Badge.tsx."
    >
      <DsSection
        title="Variants"
        description="Eight tones for status and categorization."
      >
        <ComponentPreview
          code={`<Badge variant="default">Default</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="purple">Purple</Badge>
<Badge variant="teal">Teal</Badge>
<Badge variant="orange">Orange</Badge>`}
        >
          {VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant[0].toUpperCase() + variant.slice(1)}
            </Badge>
          ))}
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="In context"
        description="Badges sit inline alongside text and headings."
      >
        <ComponentPreview
          code={`<span>TanStack Query <Badge variant="success">Stable</Badge></span>
<span>TanStack DB <Badge variant="warning">Beta</Badge></span>`}
        >
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            TanStack Query <Badge variant="success">Stable</Badge>
          </span>
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            TanStack DB <Badge variant="warning">Beta</Badge>
          </span>
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            Deprecated API <Badge variant="error">Removed</Badge>
          </span>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
