import { Link } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { MaintainerCard } from '~/components/MaintainerCard'
import { coreMaintainers } from '~/libraries/maintainers'
import { Button } from '~/components/ds/ui'

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
    <div className="space-y-24">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <div className="h-10 w-52 rounded bg-gray-200/70 dark:bg-gray-800/70 animate-pulse mb-6" />
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`maintainer-skeleton-${index}`}
              className="h-52 rounded-lg bg-gray-100/70 dark:bg-gray-900/60 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
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
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-3">
          {coreMaintainers.map((maintainer) => (
            <MaintainerCard key={maintainer.github} maintainer={maintainer} />
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Button as={Link} to="/maintainers">
            View All Maintainers
          </Button>
        </div>
      </div>
    </div>
  )
}
