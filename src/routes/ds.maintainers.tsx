import { createFileRoute } from '@tanstack/react-router'
import { MaintainerCard } from '~/components/MaintainerCard'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'
import { coreMaintainers } from '~/libraries/maintainers'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/ds/maintainers')({
  component: MaintainersPage,
  head: () => ({
    meta: seo({
      title: 'Maintainers | TanStack Design System',
      description:
        'The shared maintainer card used for core teams, instructors, and library maintainers across TanStack.',
    }),
  }),
})

function MaintainersPage() {
  return (
    <DsPage
      title="Maintainers"
      description="An identity card for core teams, instructors, and library maintainer sections. Its neutral placeholder is 240px square at full size and remains fluid in narrower columns."
    >
      <DsSection
        title="Maintainer card"
        description="Rest is transparent. Hover and keyboard focus apply the subtle surface-state overlay; press uses the stronger surface-state overlay."
      >
        <ComponentPreview
          className="items-start justify-center"
          code={`<MaintainerCard maintainer={maintainer} />`}
        >
          <div className="w-full max-w-[252px]">
            <MaintainerCard maintainer={coreMaintainers[0]} />
          </div>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Responsive grid"
        description="Use one column on narrow screens, then increase to two and three columns as the available width permits."
      >
        <ComponentPreview
          className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3"
          code={`<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {maintainers.map((maintainer) => (
    <MaintainerCard key={maintainer.github} maintainer={maintainer} />
  ))}
</div>`}
        >
          {coreMaintainers.slice(0, 3).map((maintainer) => (
            <MaintainerCard key={maintainer.github} maintainer={maintainer} />
          ))}
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
