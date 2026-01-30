import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { BottomCTA } from '~/components/BottomCTA'
import { dbProject } from '~/libraries/db'
import { LibraryHero } from '~/components/LibraryHero'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('db')

export default function DbLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero
        project={dbProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className:
            'bg-orange-500 border-orange-500 hover:bg-orange-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={dbProject.featureHighlights}
      />

      <div className="px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="pb-8">
          <h3 className="text-3xl font-bold">Blazing fast apps</h3>
          <p className="mt-6 text-xl leading-7 opacity-75 max-w-[90vw] sm:max-w-[500px] lg:max-w-[800px]">
            Built on a{' '}
            <a
              href="https://github.com/electric-sql/d2ts"
              className="text-orange-400"
            >
              Typescript implementation of differential dataflow
            </a>
            , TanStack DB gives you real-time sync, live queries and local
            writes. With no stale data, super fast re-rendering and
            sub-millisecond cross-collection queries, even for large complex
            apps.
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-10 lg:gap-x-12 gap-y-4 mx-auto max-w-[90vw] sm:max-w-[500px] lg:max-w-[650px]">
          <div>
            <h4 className="text-xl my-2">Blazing fast query engine</h4>
            <p>For sub-millisecond live queries.</p>
          </div>
          <div>
            <h4 className="text-xl my-2">Instant local writes</h4>
            <p>With sync and lifecycle support.</p>
          </div>
          <div>
            <h4 className="text-xl my-2">Fine-grained reactivity</h4>
            <p>To minimize component re-rendering.</p>
          </div>
          <div>
            <h4 className="text-xl my-2">Normalized data</h4>
            <p>To keep your backend simple and fast.</p>
          </div>
        </div>
      </div>

      <MaintainersSection libraryId="db" />
      <PartnersSection libraryId="db" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-orange-500 border-orange-500 hover:bg-orange-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
