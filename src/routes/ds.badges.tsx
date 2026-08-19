import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Badge } from '~/components/ds/ui'
import { LibraryStatusBadge } from '~/components/LibraryStatusBadge'
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
        title="Corner styles"
        description="Use rounded corners for compact labels, or the default pill for statuses."
      >
        <ComponentPreview
          code={`<Badge rounded="md">Rounded</Badge>
<Badge rounded="full">Pill</Badge>`}
        >
          <Badge rounded="md">Rounded</Badge>
          <Badge rounded="full">Pill</Badge>
          <Badge rounded="md" variant="success">
            Stable
          </Badge>
          <Badge rounded="md" variant="warning">
            Beta
          </Badge>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="In context"
        description="Badges sit inline alongside text and headings — the colored tones flag general states."
      >
        <ComponentPreview
          code={`<span>Payment <Badge variant="success">Paid</Badge></span>
<span>Build <Badge variant="warning">Pending</Badge></span>
<span>Deploy <Badge variant="error">Failed</Badge></span>`}
        >
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            Payment <Badge variant="success">Paid</Badge>
          </span>
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            Build <Badge variant="warning">Pending</Badge>
          </span>
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            Deploy <Badge variant="error">Failed</Badge>
          </span>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Library status"
        description="Library maturity badges (alpha, beta, RC, new…) are intentionally neutral — the word carries the meaning, not the color — so the chip never competes with a library's brand color and reads consistently across every surface (hero, nav, docs). Source: src/components/LibraryStatusBadge.tsx."
      >
        <ComponentPreview
          code={`<LibraryStatusBadge badge="alpha" />
<LibraryStatusBadge badge="beta" />
<LibraryStatusBadge badge="RC" />
<LibraryStatusBadge badge="new" />`}
        >
          {(['alpha', 'beta', 'RC', 'new'] as const).map((badge) => (
            <LibraryStatusBadge key={badge} badge={badge} />
          ))}
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
