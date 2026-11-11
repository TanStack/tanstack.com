import * as React from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import * as v from 'valibot'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { Button } from '~/components/ds/ui'
import { OssSponsorsWithQuery } from '~/components/OssSponsorsSection'
import { getOssSponsors } from '~/utils/sponsors.functions'
import { PartnersGrid, TierBand } from '~/components/PartnersGrid'
import {
  partnersVariantIds,
  partnersVariants,
  type PartnersVariant,
} from '~/components/partners-variants'
import type { PartnerPlacement } from '~/utils/analytics'

type PartnersSponsorsContentProps = {
  analyticsPlacement: PartnerPlacement
}

type PartnersSponsorsSectionProps = {
  analyticsPlacement?: PartnerPlacement
  className?: string
}

function OssSponsorsBand({ quiet = false }: { quiet?: boolean }) {
  // Same query OssSponsorsWithQuery runs (deduped by key). With no sponsors to
  // draw, skip the fixed-height canvas so the band doesn't hold empty space.
  const { data: sponsors } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => getOssSponsors(),
    staleTime: 5 * 60 * 1000,
  })
  const hasNoSponsors = sponsors?.length === 0

  return (
    <div id="sponsors" className="scroll-mt-24">
      {quiet ? (
        <div className="flex items-center gap-4">
          <span aria-hidden className="h-px flex-1 bg-border-default" />
          <h4 className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted">
            OSS Sponsors
          </h4>
          <span aria-hidden className="h-px flex-1 bg-border-default" />
        </div>
      ) : (
        <TierBand label="OSS Sponsors" colorClassName="bg-ds-green-400" />
      )}
      <div className="px-4 py-10">
        {hasNoSponsors ? null : (
          <div className="relative mx-auto mb-8 h-[420px] w-full overflow-hidden sm:h-[480px] lg:h-[540px] [&>div]:h-full [&>div]:w-full">
            <OssSponsorsWithQuery />
          </div>
        )}
        <p className="mx-auto max-w-(--breakpoint-sm) text-center text-ds-body-md text-text-secondary">
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
  // Exploratory layouts: `?partners=1…7` on any page with this section opens a
  // variant and shows a switcher to flip between them in place. Without the
  // parameter nothing changes.
  const search = useSearch({ strict: false })
  const fromUrl = v.safeParse(v.picklist(partnersVariantIds), search.partners)
  const [variant, setVariant] = React.useState<PartnersVariant | undefined>(
    fromUrl.success ? fromUrl.output : undefined,
  )
  const Variant = variant ? partnersVariants[variant] : undefined

  return (
    <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
      <h2
        id="partners"
        className="mb-6 scroll-mt-24 font-ds-display text-ds-heading-1 text-text-primary"
      >
        <a
          href="#partners"
          className="decoration-border-strong hover:underline"
        >
          Partners
        </a>
      </h2>
      {fromUrl.success && (
        <div className="mb-6 flex flex-wrap items-center gap-1 font-ds-mono text-ds-mono-xs text-text-muted">
          <span className="mr-2 uppercase tracking-wider">Layout</span>
          {([undefined, ...partnersVariantIds] as const).map((id) => (
            <button
              key={id ?? 'current'}
              type="button"
              aria-pressed={variant === id}
              onClick={() => setVariant(id)}
              className={`rounded-md corner-squircle px-2.5 py-1.5 transition-colors duration-150 ease-out hover:bg-surface-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${
                variant === id ? 'bg-surface-state-hover text-text-primary' : ''
              }`}
            >
              {id ?? 'Current'}
            </button>
          ))}
        </div>
      )}
      {Variant ? (
        <>
          <Variant analyticsPlacement={analyticsPlacement} />
          <div className="mt-16">
            <OssSponsorsBand quiet />
          </div>
        </>
      ) : (
        <PartnersGrid
          analyticsPlacement={analyticsPlacement}
          trailingBand={<OssSponsorsBand />}
        />
      )}
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
            <div className="h-10 animate-pulse bg-gray-200/70 dark:bg-gray-800/70" />
            <div
              className="grid gap-px bg-gray-200/70 dark:bg-gray-800/70"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: columns * 2 }).map((_, index) => (
                <div
                  key={`partner-skeleton-${band}-${index}`}
                  className="min-h-[104px] animate-pulse bg-white/70 dark:bg-gray-950/60"
                />
              ))}
            </div>
          </div>
        ))}
        <div className="h-10 animate-pulse bg-gray-200/70 dark:bg-gray-800/70" />
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
