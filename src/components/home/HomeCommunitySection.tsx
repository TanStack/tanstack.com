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
  <div aria-hidden="true" className="pb-16">
    <div className="aspect-square sm:aspect-[5/4]" />
  </div>
)

export function HomeCommunitySection() {
  return (
    <Hydrate
      when={visible({ rootMargin: '25%' })}
      fallback={
        <div className="mx-auto max-w-(--breakpoint-lg) px-4 pt-16">
          {globeFallback}
        </div>
      }
    >
      <HomeCommunityContent />
    </Hydrate>
  )
}

function HomeCommunityContent() {
  return (
    <section
      aria-labelledby="maintainers"
      className="@container isolate mx-auto w-full max-w-(--breakpoint-lg) space-y-4 px-4"
    >
      <header className="lg:-translate-y-4">
        <h2
          id="maintainers"
          className="scroll-mt-24 text-center text-4xl font-[500] leading-[1.05] tracking-[-0.8px] sm:text-5xl lg:text-[64px]"
        >
          <a
            href="#maintainers"
            className="decoration-gray-400 hover:underline dark:decoration-gray-600"
          >
            We&apos;re Everywhere!
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
          View Maintainers
          <ArrowRightIcon />
        </ButtonLink>
      </div>
    </section>
  )
}
