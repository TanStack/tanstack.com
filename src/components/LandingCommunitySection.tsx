import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import type { LibraryId } from '~/libraries'
import { MaintainersSection } from './MaintainersSection'
import { Skeleton, SkeletonGroup } from '~/components/ds/ui'

interface LandingCommunitySectionProps {
  libraryId: LibraryId
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="px-4 w-full lg:max-w-(--breakpoint-lg) md:mx-auto">
      <SkeletonGroup label={`Loading ${title}`} className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={`${title}-${index}`}
              className="aspect-square rounded-lg"
            />
          ))}
        </div>
      </SkeletonGroup>
    </div>
  )
}

export function LandingCommunitySection({
  libraryId,
}: LandingCommunitySectionProps) {
  return (
    <Hydrate
      when={visible({ rootMargin: '25%' })}
      fallback={<SectionSkeleton title="Maintainers" />}
    >
      <MaintainersSection libraryId={libraryId} />
    </Hydrate>
  )
}
