import { FaCheckCircle } from 'react-icons/fa'
import { Footer } from '~/components/Footer'
import { SponsorsSection } from '~/components/SponsorsSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { devtoolsProject } from '~/libraries/devtools'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { getRouteApi } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: DevtoolsVersionIndex,
  head: () => ({
    meta: seo({
      title: devtoolsProject.name,
      description: devtoolsProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

export default function DevtoolsVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
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
                  <FaCheckCircle className="text-green-500 " /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <PartnersSection libraryId="devtools" />

        <SponsorsSection sponsorsPromise={sponsorsPromise} />

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
