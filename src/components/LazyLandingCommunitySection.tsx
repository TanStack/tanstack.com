import * as React from 'react'
import type { LibraryId } from '~/libraries'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'

const LazyMaintainersSection = React.lazy(async () => {
  const mod = await import('./MaintainersSection')

  return { default: mod.MaintainersSection }
})

const LazyPartnersSection = React.lazy(async () => {
  const mod = await import('./PartnersSection')

  return { default: mod.PartnersSection }
})

interface LazyLandingCommunitySectionProps {
  libraryId: LibraryId
  libraryName: string
  showShowcases?: boolean
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="px-4 w-full lg:max-w-(--breakpoint-lg) md:mx-auto">
      <div className="space-y-8">
        <div className="h-10 w-48 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`${title}-${index}`}
              className="aspect-square rounded-lg bg-gray-200/70 dark:bg-gray-800/70 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function LazyLandingCommunitySection({
  libraryId,
}: LazyLandingCommunitySectionProps) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '25%',
    triggerOnce: true,
  })

  return (
    <div ref={ref} className="flex flex-col gap-20 md:gap-24">
      {!isIntersecting ? (
        <>
          <SectionSkeleton title="Maintainers" />
          <SectionSkeleton title="Partners" />
        </>
      ) : (
        <React.Suspense
          fallback={
            <>
              <SectionSkeleton title="Maintainers" />
              <SectionSkeleton title="Partners" />
            </>
          }
        >
          <LazyMaintainersSection libraryId={libraryId} />
          <LazyPartnersSection libraryId={libraryId} />
        </React.Suspense>
      )}
    </div>
  )
}
