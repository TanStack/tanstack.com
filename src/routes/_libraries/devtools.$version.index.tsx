import { createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { devtoolsProject } from '~/libraries/devtools'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { seo } from '~/utils/seo'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'
import { ossStatsQuery } from '~/queries/stats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'
import { CheckCircleIcon } from '~/components/icons/CheckCircleIcon'

const library = getLibrary('devtools')

export const Route = createFileRoute('/_libraries/devtools/$version/')({
  component: DevtoolsVersionIndex,
  head: () => ({
    meta: seo({
      title: devtoolsProject.name,
      description: devtoolsProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function DevtoolsVersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const library = getLibrary('devtools')

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 pt-32">
        <LibraryHero
          project={devtoolsProject}
          cta={{
            linkProps: {
              from: '/$libraryId/$version',
              to: './docs',
              params: { libraryId: library.id },
            },
            label: 'Get Started',
            className: 'bg-slate-500 hover:bg-slate-600 text-white',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>
        <AdGate>
          <GamHeader />
        </AdGate>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Unified Development Experience
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              TanStack Devtools brings together all your development tools in
              one place, making debugging and development more efficient than
              ever before.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-max mx-auto">
            {[
              'Centralized Panel',
              'Framework Agnostic',
              'Custom Devtools',
              'Lightweight',
              'Solid.js Powered',
              'Extensible API',
              'Type Safe',
              'Plugin System',
              'Real-time Updates',
            ].map((d, i) => {
              return (
                <span key={i} className="flex items-center gap-2">
                  <CheckCircleIcon className="text-green-500 " /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <PartnersSection libraryId="devtools" />

        <LazySponsorSection />

        <LandingPageGad />

        <BottomCTA
          linkProps={{
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          }}
          label="Get Started!"
          className="bg-slate-500 hover:bg-slate-600 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
