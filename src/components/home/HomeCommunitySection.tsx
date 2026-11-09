import { Link } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { MaintainerCard } from '~/components/MaintainerCard'
import { coreMaintainers } from '~/libraries/maintainers'
import { Button, Skeleton, SkeletonGroup } from '~/components/ds/ui'

export function HomeCommunitySection() {
  return (
    <Hydrate
      when={visible({ rootMargin: '25%' })}
      fallback={<CommunitySkeleton />}
    >
      <HomeCommunityContent />
    </Hydrate>
  )
}

function CommunitySkeleton() {
  return (
    <SkeletonGroup label="Loading maintainers" className="space-y-24">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <Skeleton className="mb-6 h-10 w-52 corner-squircle" />
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton
              key={`maintainer-skeleton-${index}`}
              className="h-52 rounded-lg corner-squircle"
            />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  )
}

function HomeCommunityContent() {
  return (
    <div className="space-y-24">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <h3 id="maintainers" className="text-3xl font-bold mb-6 scroll-mt-24">
          <a
            href="#maintainers"
            className="hover:underline decoration-gray-400 dark:decoration-gray-600"
          >
            Core Maintainers
          </a>
        </h3>
        <div className="grid grid-cols-2 gap-6 [&>*]:max-w-none sm:grid-cols-3 lg:grid-cols-5">
          {coreMaintainers.map((maintainer) => (
            <MaintainerCard key={maintainer.github} maintainer={maintainer} />
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Button
            as={Link}
            to="/maintainers"
            variant="subtle-link"
            color="gray"
          >
            View All Maintainers
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
