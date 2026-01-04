import * as React from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { startProject } from '~/libraries/start'
import { seo } from '~/utils/seo'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import OpenSourceStats from '~/components/OpenSourceStats'
import { Button } from '~/components/Button'
import { ossStatsQuery } from '~/queries/stats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { Book, Wallpaper } from 'lucide-react'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { LibraryShowcases } from '~/components/ShowcaseSection'

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
            <Button
              as={Link}
              from={'/$libraryId/$version'}
              to={'./docs/framework/$framework/$'}
              params={{
                libraryId: library.id,
                framework: 'react',
                _splat: 'quick-start',
              }}
              hash={'impatient'}
              className="bg-transparent border-cyan-500 dark:border-cyan-600 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
            >
              Try it in 60 seconds
            </Button>
            <Button
              as={Link}
              from="/$libraryId/$version"
              to="./docs"
              params={{ libraryId: library.id }}
              className="bg-cyan-500 border-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:border-cyan-600 text-white"
            >
              Get Started
            </Button>
          </div>
        }
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>

      <LibraryFeatureHighlights featureHighlights={startProject.featureHighlights} />

      <LibraryTestimonials testimonials={startProject.testimonials} />

      <div className="space-y-8 px-4">
        <div className="font-black text-3xl mr-1 text-center">
          When can I use it?
        </div>
        <div className="max-w-full p-8 w-[800px] mx-auto leading-loose space-y-4 bg-white dark:bg-gray-900 rounded-xl shadow-xs border border-gray-300 dark:border-gray-800">
          <div>
            You can use <strong>TanStack Start RC</strong> today! We're
            feature-complete and preparing for 1.0. We invite you to provide
            feedback to help us finalize the release! If you choose to ship an
            RC Start app to production, we recommend locking your dependencies
            to a specific version and keeping up with the latest releases.
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
            className="flex items-center gap-2 py-2 px-4 bg-cyan-900 rounded-lg text-white font-black"
          >
            <Wallpaper className="min-w-4" /> See an Example
          </Link>
          <Link
            from={'/$libraryId/$version'}
            to="./docs"
            params={{ libraryId: library.id }}
            className="flex items-center gap-2 py-2 px-4 bg-cyan-800 rounded-lg text-white font-black"
          >
            <Book className="min-w-4" /> Try it out!
          </Link>
          <a
            href={`https://github.com/tanstack/tanstack.com`}
            className={`flex items-center gap-2 py-2 px-4 bg-cyan-700 rounded-lg text-white font-black`}
          >
            <GithubIcon className="min-w-4" /> TanStack.com Source
          </a>
          <a
            href={`https://twitter.com/intent/post?text=${encodeURIComponent(
              `TanStack Start is in BETA! It's a new full-stack React framework from @Tan_Stack and you can check it out at https://tanstack.com/start/`,
            )}`}
            target="_blank"
            className="flex items-center gap-2 py-2 px-4 bg-cyan-500 rounded-lg text-white font-black"
            rel="noreferrer"
          >
            <BrandXIcon className="min-w-4" /> Tweet about it!
          </a>{' '}
        </div>
      </div>

      <PartnersSection libraryId="start" />

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <LibraryShowcases libraryId="start" libraryName="TanStack Start" />
      </div>

      <LazySponsorSection />

      <LandingPageGad />

      <BottomCTA
        linkProps={{
          from: '/$libraryId/$version',
          to: './docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-cyan-500 border-cyan-500 hover:bg-cyan-600 text-white"
      />
      <Footer />
    </div>
  )
}
