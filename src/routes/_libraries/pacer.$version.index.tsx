import { Link, getRouteApi } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { PartnersSection } from '~/components/PartnersSection'
import { SponsorsSection } from '~/components/SponsorsSection'
import { BottomCTA } from '~/components/BottomCTA'
import { pacerProject } from '~/libraries/pacer'
import { seo } from '~/utils/seo'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: PacerVersionIndex,
  head: () => ({
    meta: seo({
      title: pacerProject.name,
      description: pacerProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')
const library = getLibrary('pacer')

export default function PacerVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <LibraryHero
          project={pacerProject}
          cta={{
            linkProps: {
              from: '/$libraryId/$version',
              to: './docs',
              params: { libraryId: library.id },
            },
            label: 'Get Started',
            className: 'bg-lime-600 hover:bg-lime-700 text-white',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <div className="px-4 sm:px-6 lg:px-8 mx-auto">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Framework Agnostic & Feature Rich
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              TanStack Pacer's API is highly modular and framework-independent
              while still prioritizing ergonomics. Behold, the obligatory
              feature-list:
            </p>
          </div>
          <FeatureGrid
            title="Framework Agnostic & Feature Rich"
            items={[
              'Lightweight',
              'Tree-Shaking',
              'Type-Safe',
              'Framework Agnostic',
              'Reactive & Subscribable State',
              'Rate Limiting',
              'Throttling',
              'Debouncing',
              'Queuing',
              'Batching',
              'Flush Controls',
              'LIFO/FIFO/Dequeue Ordering',
              'Concurrency Control',
              'Queue Prioritization',
              'Pause/Resume Controls',
              'Cancellation',
              'Abort Controller Support',
              'Async/Sync Execution',
              'Multiple Layers of Abstraction',
            ]}
            gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4 mx-auto"
          />
        </div>

        <PartnersSection libraryId="pacer" />

        <SponsorsSection sponsorsPromise={sponsorsPromise} />

        <LandingPageGad />

        <BottomCTA
          linkProps={{
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          }}
          label="Get Started!"
          className="bg-lime-600 hover:bg-lime-700 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
