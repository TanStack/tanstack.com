import { Link } from '@tanstack/react-router'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { MaintainerCard } from '~/components/MaintainerCard'
import { coreMaintainers } from '~/libraries/maintainers'
import { Button } from '~/ui'

export function HomeCommunitySection() {
  return (
    <div className="space-y-24">
      <div className="lg:max-w-(--breakpoint-lg) px-4 mx-auto">
        <div id="sponsors" className="scroll-mt-24">
          <LazySponsorSection
            title={
              <a
                href="#sponsors"
                className="hover:underline decoration-gray-400 dark:decoration-gray-600"
              >
                OSS Sponsors
              </a>
            }
          />
        </div>
        <div className="h-4" />
        <p className="italic mx-auto max-w-(--breakpoint-sm) text-gray-500 dark:text-gray-400 text-center">
          Sponsors get special perks like{' '}
          <strong>
            private discord channels, priority issue requests, and direct
            support
          </strong>
          !
        </p>
      </div>

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
