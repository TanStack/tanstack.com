import { Link } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { Button } from '~/components/ds/ui'
import { OssSponsorsWithQuery } from '~/components/OssSponsorsSection'
import { PartnersGrid, TierBand } from '~/components/PartnersGrid'
import type { PartnerPlacement } from '~/utils/analytics'

type PartnersSponsorsContentProps = {
  analyticsPlacement: PartnerPlacement
}

type PartnersSponsorsSectionProps = {
  analyticsPlacement?: PartnerPlacement
  className?: string
}

function OssSponsorsBand() {
  return (
    <div id="sponsors" className="scroll-mt-24">
      <TierBand label="OSS Sponsors" colorClassName="bg-ds-green-400" />
      <div className="px-4 py-10">
        <div className="relative mx-auto h-[420px] w-full overflow-hidden sm:h-[480px] lg:h-[540px] [&>div]:h-full [&>div]:w-full">
          <OssSponsorsWithQuery />
        </div>
        <p className="mx-auto mt-8 max-w-(--breakpoint-sm) text-center italic text-gray-500 dark:text-gray-400">
          Sponsors get special perks like{' '}
          <strong>
            private discord channels, priority issue requests, and direct
            support
          </strong>
          !
        </p>
        <div className="mt-6 flex justify-center">
          <Button as="a" href="https://github.com/sponsors/tannerlinsley">
            Become a Sponsor
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PartnersSponsorsContent({
  analyticsPlacement,
}: PartnersSponsorsContentProps) {
  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
      <h3 id="partners" className="mb-6 scroll-mt-24 text-3xl font-bold">
        <a
          href="#partners"
          className="decoration-gray-400 hover:underline dark:decoration-gray-600"
        >
          Partners
        </a>
      </h3>
      <PartnersGrid
        analyticsPlacement={analyticsPlacement}
        trailingBand={<OssSponsorsBand />}
      />
      <div className="mt-6 flex justify-center">
        <Link to="/partners" search={{ status: 'inactive' }}>
          <Button as="span" variant="subtle-link" color="gray">
            View Previous Partners
            <ArrowRightIcon />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function PartnersSponsorsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto"
    >
      <div className="mb-6 h-10 w-40 animate-pulse rounded bg-gray-200/70 dark:bg-gray-800/70" />
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        {[2, 3].map((columns, band) => (
          <div key={`partner-band-${band}`}>
            <div className="h-12 animate-pulse bg-gray-200/70 dark:bg-gray-800/70" />
            <div
              className="grid gap-px bg-gray-200/70 dark:bg-gray-800/70"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: columns * 2 }).map((_, index) => (
                <div
                  key={`partner-skeleton-${band}-${index}`}
                  className="min-h-[130px] animate-pulse bg-white/70 dark:bg-gray-950/60"
                />
              ))}
            </div>
          </div>
        ))}
        <div className="h-12 animate-pulse bg-gray-200/70 dark:bg-gray-800/70" />
        <div className="h-[420px] animate-pulse bg-white/70 sm:h-[480px] lg:h-[540px] dark:bg-gray-950/60" />
      </div>
    </div>
  )
}

export function PartnersSponsorsSection({
  analyticsPlacement = 'library_grid',
  className = '',
}: PartnersSponsorsSectionProps) {
  return (
    <section className={className}>
      <Hydrate
        when={visible({ rootMargin: '25%' })}
        fallback={<PartnersSponsorsSkeleton />}
      >
        <PartnersSponsorsContent analyticsPlacement={analyticsPlacement} />
      </Hydrate>
    </section>
  )
}
