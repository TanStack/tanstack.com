import * as React from 'react'

import { FaBook, FaGithub } from 'react-icons/fa'

import { Link, createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { startProject } from '~/libraries/start'
import { seo } from '~/utils/seo'
import { VscPreview } from 'react-icons/vsc'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats, { ossStatsQuery } from '~/components/OpenSourceStats'
import { TbBrandX } from 'react-icons/tb'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'

const library = getLibrary('start')

export const Route = createFileRoute('/_libraries/start/$version/')({
  component: VersionIndex,
  head: () => ({
    meta: seo({
      title: startProject.name,
      description: startProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function VersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    if (isDark) {
      //
    }
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [isDark])

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={startProject}
        actions={
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              from={'/$libraryId/$version'}
              to={'./docs/framework/$framework/$'}
              params={{
                libraryId: library.id,
                framework: 'react',
                _splat: 'quick-start',
              }}
              hash={'impatient'}
              className={`py-2 px-4 bg-transparent text-cyan-600 dark:text-cyan-400 border-2 border-cyan-500 dark:border-cyan-600 rounded uppercase font-extrabold`}
            >
              Try it in 60 seconds
            </Link>
            <Link
              from="/$libraryId/$version"
              to="./docs"
              params={{ libraryId: library.id }}
              className={`py-2 px-4 bg-cyan-500 dark:bg-cyan-600 rounded text-white uppercase font-extrabold flex items-center`}
            >
              Get Started
            </Link>
          </div>
        }
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>

      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />

      <div className="space-y-8 px-4">
        <div className="font-black text-3xl mr-1 text-center">
          When can I use it?
        </div>
        <div className="max-w-full p-8 w-[800px] mx-auto leading-loose space-y-4 bg-white dark:bg-black/40 rounded-xl shadow-xl shadow-black/10">
          <div>
            You can use <strong>TanStack Start BETA</strong> today! Although
            currently in active development, we do not expect any more breaking
            changes. We invite you to provide feedback to help us on the journey
            to 1.0! If you choose to ship a BETA Start app to production, we
            recommend locking your dependencies to a specific version and
            keeping up with the latest releases.
          </div>
        </div>
        <div className="grid items-center gap-2 justify-center grid-cols-1 sm:grid-cols-2 w-[600px] max-w-full mx-auto">
          <Link
            from={'/$libraryId/$version'}
            to="./docs/framework/$framework/examples/$"
            params={{
              libraryId: library.id,
              framework: 'react',
              _splat: 'start-basic',
            }}
            className="flex items-center gap-2 py-2 px-4 bg-cyan-900 rounded text-white uppercase font-extrabold"
          >
            <VscPreview className="min-w-4" /> See an Example
          </Link>
          <Link
            from={'/$libraryId/$version'}
            to="./docs"
            params={{ libraryId: library.id }}
            className="flex items-center gap-2 py-2 px-4 bg-cyan-800 rounded text-white uppercase font-extrabold"
          >
            <FaBook className="min-w-4" /> Try the BETA
          </Link>
          <a
            href={`https://github.com/tanstack/tanstack.com`}
            className={`flex items-center gap-2 py-2 px-4 bg-cyan-700 rounded text-white uppercase font-extrabold`}
          >
            <FaGithub className="min-w-4" /> TanStack.com Source
          </a>
          <a
            href={`https://twitter.com/intent/post?text=${encodeURIComponent(
              `TanStack Start is in BETA! It's a new full-stack React framework from @Tan_Stack and you can check it out at https://tanstack.com/start/`
            )}`}
            target="_blank"
            className="flex items-center gap-2 py-2 px-4 bg-cyan-500 rounded text-white uppercase font-extrabold"
            rel="noreferrer"
          >
            <TbBrandX className="min-w-4" /> Tweet about it!
          </a>{' '}
        </div>
      </div>

      <PartnersSection libraryId="start" />

      <LazySponsorSection />

      <LandingPageGad />

      <BottomCTA
        linkProps={{
          from: '/$libraryId/$version',
          to: './docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-cyan-500 text-white"
      />
      <Footer />
    </div>
  )
}
