import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Avatar } from '~/components/ds/ui'
import { MaintainerCard } from '~/components/MaintainerCard'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'
import { coreMaintainers } from '~/libraries/maintainers'

export const Route = createFileRoute('/ds/avatar')({
  component: AvatarPage,
  head: () => ({
    meta: seo({
      title: 'Avatar | TanStack Design System',
      description: 'The Avatar component — image, initials, and fallback.',
    }),
  }),
})

const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'] as const

function AvatarPage() {
  return (
    <DsPage
      title="Avatar"
      description="Identity components for individual users and TanStack maintainers. Avatar renders a user image with initials and generic fallbacks; MaintainerCard adds profile links and responsive portrait sizing."
    >
      <DsSection title="Sizes" description="2xs through xl.">
        <ComponentPreview
          code={`<Avatar name="Tanner Linsley" size="2xs" />
<Avatar name="Tanner Linsley" size="xs" />
{/* …sm, md, lg, xl */}`}
        >
          {SIZES.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <Avatar name="Tanner Linsley" size={size} />
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {size}
              </span>
            </div>
          ))}
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Fallbacks"
        description="Initials from a name or email, and a generic icon when neither is present."
      >
        <ComponentPreview
          code={`<Avatar name="Tanner Linsley" size="lg" />
<Avatar email="dev@tanstack.com" size="lg" />
<Avatar size="lg" />`}
        >
          <div className="flex flex-col items-center gap-2">
            <Avatar name="Tanner Linsley" size="lg" />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              name
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar email="dev@tanstack.com" size="lg" />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              email
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar size="lg" />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              icon
            </span>
          </div>
        </ComponentPreview>
      </DsSection>

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
        title="Responsive maintainer grid"
        description="Use one column on narrow screens, then increase to two and three columns as the available width permits."
      >
        <ComponentPreview
          className="grid justify-items-center gap-6 sm:grid-cols-2 xl:grid-cols-3"
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
