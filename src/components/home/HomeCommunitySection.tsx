import { lazy, Suspense } from 'react'
import { ClientOnly, createLink } from '@tanstack/react-router'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { Button } from '~/components/ds/ui'
import { allMaintainers } from '~/libraries/maintainers'

const ButtonLink = createLink(Button)

const MaintainersMap = lazy(() =>
  import('~/components/MaintainersMap').then((module) => ({
    default: module.MaintainersMap,
  })),
)

const globeFallback = <div aria-hidden="true" className="h-(--globe-height)" />

export function HomeCommunitySection() {
  return (
    <section
      aria-labelledby="maintainers"
      className="@container isolate mx-auto flex w-full max-w-(--breakpoint-lg) flex-col gap-4 px-4 [--globe-width:calc(100cqw+2rem)] [--globe-height:calc(var(--globe-width)*1.25)] sm:[--globe-width:min(120cqw,calc(100vw-1rem))] sm:[--globe-height:var(--globe-width)]"
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
            Who builds TanStack?
          </a>
        </h2>
        <p
          id="maintainers-globe-help"
          className="mt-3 text-center text-xs leading-relaxed text-text-muted opacity-80"
        >
          <span className="hidden sm:inline sm:pointer-coarse:hidden">
            Select to see nearby maintainers,{' '}
            <kbd className="font-sans font-semibold">Esc</kbd> to close.
          </span>
          <span className="sm:hidden sm:pointer-coarse:inline">
            Tap a profile to see nearby maintainers.
          </span>
        </p>
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
