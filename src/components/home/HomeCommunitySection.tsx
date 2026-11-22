import { lazy, Suspense } from 'react'
import { ClientOnly, createLink } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { Button } from '~/components/ds/ui'
import { allMaintainers } from '~/libraries/maintainers'

const ButtonLink = createLink(Button)

const MaintainersMap = lazy(() =>
  import('~/components/MaintainersMap').then((module) => ({
    default: module.MaintainersMap,
  })),
)

const globeFallback = (
  <div aria-hidden="true" className="box-content h-(--globe-height) pb-16" />
)

export function HomeCommunitySection() {
  return (
    <div className="@container mx-auto w-full max-w-(--breakpoint-lg) px-4 [--globe-width:calc(100cqw+2rem)] [--globe-height:calc(var(--globe-width)*1.25)] sm:[--globe-width:min(120cqw,calc(100vw-1rem))] sm:[--globe-height:calc(var(--globe-width)*0.875)]">
      <Hydrate
        when={visible({ rootMargin: '25%' })}
        fallback={<div className="pt-16">{globeFallback}</div>}
      >
        <HomeCommunityContent />
      </Hydrate>
    </div>
  )
}

function HomeCommunityContent() {
  return (
    <section
      aria-labelledby="maintainers"
      className="isolate flex flex-col gap-4"
    >
      <header className="sm:mb-10 lg:-mt-6">
        <h2
          id="maintainers"
          className="scroll-mt-24 text-center text-4xl font-[500] leading-[1.05] tracking-[-0.8px] sm:text-5xl lg:text-[64px]"
        >
          <a
            href="#maintainers"
            className="decoration-gray-400 hover:underline dark:decoration-gray-600"
          >
            We&apos;re everywhere!
          </a>
        </h2>
      </header>
      <ClientOnly fallback={globeFallback}>
        <Suspense fallback={globeFallback}>
          <MaintainersMap maintainers={allMaintainers} />
        </Suspense>
      </ClientOnly>
      <div className="relative z-20 flex justify-end">
        <ButtonLink as="a" to="/maintainers" variant="subtle-link" color="gray">
          View Maintainers &amp; Contributors
          <ArrowRightIcon />
        </ButtonLink>
      </div>
    </section>
  )
}
