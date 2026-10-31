import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import type { LibraryId } from '~/libraries'
import { MaintainersSection } from './MaintainersSection'

interface LandingCommunitySectionProps {
  libraryId: LibraryId
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
