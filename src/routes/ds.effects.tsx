import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/effects')({
  component: EffectsPage,
  head: () => ({
    meta: seo({
      title: 'Effects | TanStack Design System',
      description:
        'Signature TanStack visual effects — animated gradient text and glass surfaces.',
    }),
  }),
})

function EffectsPage() {
  return (
    <DsPage
      title="Effects"
      description="The signature TanStack flourishes. These are global utility classes defined in app.css — apply the class name directly. Motion respects prefers-reduced-motion."
    >
      <DsSection
        title="Animated gradient text"
        description="Used in the homepage hero. Apply .home-open-source-gradient to an inline element; it animates a 6-stop rainbow across the text."
      >
        <ComponentPreview
          className="block"
          code={`<span className="home-open-source-gradient text-4xl">open-source</span>`}
        >
          <div className="text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">
            The <span className="home-open-source-gradient">open-source</span>{' '}
            application stack
          </div>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Glass surface"
        description="Apply .ts-glass-menu to a panel sitting over a colorful or blurred backdrop to add a subtle frosted-glass sheen and inset highlights."
      >
        <ComponentPreview
          className="block"
          code={`<div className="ts-glass-menu rounded-2xl bg-white/10 backdrop-blur-xl p-6">
  …panel content…
</div>`}
        >
          <div className="relative overflow-hidden rounded-2xl p-8">
            <div className="absolute inset-0 bg-linear-to-br from-teal-400 via-blue-500 to-purple-600" />
            <div className="relative flex justify-center">
              <div className="ts-glass-menu rounded-2xl bg-white/10 px-8 py-6 text-center backdrop-blur-xl">
                <div className="text-lg font-semibold text-white">
                  Glass panel
                </div>
                <div className="mt-1 text-sm text-white/80">
                  .ts-glass-menu over a gradient backdrop
                </div>
              </div>
            </div>
          </div>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
