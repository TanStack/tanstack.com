import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Avatar } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

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
      description="Renders a user image when available, falls back to initials from name/email, then to a generic icon. Source: src/components/Avatar.tsx."
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
    </DsPage>
  )
}
