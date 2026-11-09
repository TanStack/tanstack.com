import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Card, Skeleton, SkeletonGroup } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/skeleton')({
  component: SkeletonPage,
  head: () => ({
    meta: seo({
      title: 'Skeletons | TanStack Design System',
      description:
        'Skeleton placeholder blocks, surface behavior, grouping, and accessibility.',
    }),
  }),
})

function SkeletonPage() {
  return (
    <DsPage
      title="Skeletons"
      description="Placeholder blocks shown while content loads. Mirror the shape of what is coming so the layout does not shift when the real content arrives."
    >
      <DsSection
        id="shapes"
        title="Skeleton"
        description={
          <>
            Size it with w-/h- utilities and change the corner with rounded-*.
            The tint comes from the component, so pass only layout classes.
            <br />
            Source:{' '}
            <a
              href="https://github.com/TanStack/tanstack.com/blob/main/src/components/ds/ui/index.tsx"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-text-primary"
            >
              src/components/ds/ui/index.tsx
            </a>
            .
          </>
        }
      >
        <ComponentPreview
          code={`<Skeleton className="h-4 w-32" />
<Skeleton className="h-10 w-10 rounded-full" />
<Skeleton className="h-20 w-32 rounded-lg" />`}
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-20 w-32 rounded-lg" />
        </ComponentPreview>
      </DsSection>

      <DsSection
        id="surfaces"
        title="On any surface"
        description="The tint is an alpha overlay, not an opaque color, so it always reads lighter than whatever is behind it in dark mode and darker in light. An opaque surface token cannot do that: in dark mode it is lighter than the page but darker than a raised card, so it inverts as it moves between surfaces."
      >
        <ComponentPreview
          code={`<Skeleton className="h-16 w-full" />

<Card className="p-4">
  <Skeleton className="h-16 w-full" />
</Card>`}
        >
          <div className="w-full space-y-4">
            <Skeleton className="h-16 w-full" />
            <Card className="p-4">
              <Skeleton className="h-16 w-full" />
            </Card>
          </div>
        </ComponentPreview>
      </DsSection>

      <DsSection
        id="grouping"
        title="Grouping and accessibility"
        description="Each block is aria-hidden, so a lone skeleton announces nothing. Wrap a loading region in SkeletonGroup to give screen readers one message for the whole area. The pulse is wrapped in motion-safe:, so it holds still under prefers-reduced-motion."
      >
        <ComponentPreview
          code={`<SkeletonGroup label="Loading maintainers" className="space-y-3">
  <Skeleton className="h-6 w-40" />
  <div className="grid grid-cols-3 gap-3">
    <Skeleton className="h-24" />
    <Skeleton className="h-24" />
    <Skeleton className="h-24" />
  </div>
</SkeletonGroup>`}
        >
          <SkeletonGroup
            label="Loading maintainers"
            className="w-full space-y-3"
          >
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </SkeletonGroup>
        </ComponentPreview>
      </DsSection>

      <DsSection
        id="matching"
        title="Match the real layout"
        description="Reuse the same grid, gap, and block heights as the content it stands in for. A skeleton that does not match the loaded UI trades a blank screen for a layout shift."
      >
        <ComponentPreview
          code={`<SkeletonGroup label="Loading posts" className="space-y-4">
  {Array.from({ length: 3 }).map((_, index) => (
    <div key={index} className="flex gap-3">
      <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  ))}
</SkeletonGroup>`}
        >
          <SkeletonGroup label="Loading posts" className="w-full space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`post-skeleton-${index}`} className="flex gap-3">
                <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
