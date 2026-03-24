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

const LazyLibraryShowcases = React.lazy(async () => {
  const mod = await import('./ShowcaseSection')

  return { default: mod.LibraryShowcases }
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

function ShowcaseSkeleton() {
  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto w-full">
      <div className="space-y-8 py-16">
        <div className="space-y-2">
          <div className="h-10 w-64 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
          <div className="h-6 w-80 max-w-full rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`showcase-${index}`}
              className="aspect-video rounded-xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function LazyLandingCommunitySection({
  libraryId,
  libraryName,
  showShowcases = true,
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
          {showShowcases ? <ShowcaseSkeleton /> : null}
        </>
      ) : (
        <React.Suspense
          fallback={
            <>
              <SectionSkeleton title="Maintainers" />
              <SectionSkeleton title="Partners" />
              {showShowcases ? <ShowcaseSkeleton /> : null}
            </>
          }
        >
          <LazyMaintainersSection libraryId={libraryId} />
          <LazyPartnersSection libraryId={libraryId} />
          {showShowcases ? (
            <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
              <LazyLibraryShowcases
                libraryId={libraryId}
                libraryName={libraryName}
              />
            </div>
          ) : null}
        </React.Suspense>
      )}
    </div>
  )
}
