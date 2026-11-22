import { lazy, Suspense, useState } from 'react'
import { ClientOnly, createLink } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react'
import { MaintainersFilter } from '~/components/MaintainersFilter'
import { Button } from '~/components/ds/ui'
import { getMaintainersForLibraries } from '~/libraries/maintainers'
import type { LibraryId } from '~/libraries/types'

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
        <div className="mx-auto max-w-(--breakpoint-lg) px-4 pt-28">
          {globeFallback}
        </div>
      }
    >
      <HomeCommunityContent />
    </Hydrate>
  )
}

function HomeCommunityContent() {
  const [selectedLibraries, setSelectedLibraries] = useState<LibraryId[]>()

  return (
    <section
      aria-labelledby="maintainers"
      className="@container isolate mx-auto w-full max-w-(--breakpoint-lg) space-y-4 px-4"
    >
      <header>
        <h2 id="maintainers" className="scroll-mt-24 text-3xl font-bold">
          <a
            href="#maintainers"
            className="decoration-gray-400 hover:underline dark:decoration-gray-600"
          >
            Maintainers
          </a>
        </h2>
      </header>
      <MaintainersFilter
        selectedLibraries={selectedLibraries}
        onLibrariesChange={setSelectedLibraries}
        onClearAll={() => setSelectedLibraries(undefined)}
      />
      <ClientOnly fallback={globeFallback}>
        <Suspense fallback={globeFallback}>
          <MaintainersMap
            maintainers={getMaintainersForLibraries(selectedLibraries)}
            selectedLibraries={selectedLibraries}
          />
        </Suspense>
      </ClientOnly>
      <div className="relative z-20 flex justify-center">
        <ButtonLink
          as="a"
          to="/maintainers"
          search={{ libraries: selectedLibraries }}
          variant="subtle-link"
          color="gray"
        >
          View Maintainer Directory
          <ArrowRightIcon />
        </ButtonLink>
      </div>
    </section>
  )
}
