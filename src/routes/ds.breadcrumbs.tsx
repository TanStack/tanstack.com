import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Breadcrumbs } from '~/components/ds/ui'
import type { MarkdownHeading } from '~/utils/markdown'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/breadcrumbs')({
  component: BreadcrumbsPage,
  head: () => ({
    meta: seo({
      title: 'Breadcrumbs | TanStack Design System',
      description: 'The docs Breadcrumbs / on-this-page component.',
    }),
  }),
})

const SAMPLE_HEADINGS: Array<MarkdownHeading> = [
  { id: 'overview', text: 'Overview', level: 2 },
  { id: 'installation', text: 'Installation', level: 2 },
  { id: 'configuration', text: 'Configuration', level: 3 },
  { id: 'usage', text: 'Usage', level: 2 },
]

function BreadcrumbsPage() {
  return (
    <DsPage
      title="Breadcrumbs"
      description="The docs section label with an optional “On this page” table-of-contents dropdown (shown on narrower viewports). Source: src/components/Breadcrumbs.tsx."
    >
      <DsSection
        title="Section + on-this-page"
        description="Pass a section label and the page headings. The TOC toggle appears below the configured breakpoint."
      >
        <ComponentPreview
          className="block"
          code={`<Breadcrumbs
  section="Getting Started"
  sectionTo="/ds"
  tocHiddenBreakpoint="xl"
  headings={[
    { id: 'overview', text: 'Overview', level: 2 },
    { id: 'installation', text: 'Installation', level: 2 },
    { id: 'configuration', text: 'Configuration', level: 3 },
    { id: 'usage', text: 'Usage', level: 2 },
  ]}
/>`}
        >
          <div className="w-full max-w-md">
            <Breadcrumbs
              section="Getting Started"
              sectionTo="/ds"
              tocHiddenBreakpoint="xl"
              headings={SAMPLE_HEADINGS}
            />
          </div>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
