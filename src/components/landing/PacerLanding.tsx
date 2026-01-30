import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { pacerProject } from '~/libraries/pacer'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { FeatureGridSection } from '~/components/FeatureGridSection'

const library = getLibrary('pacer')

export default function PacerLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero
        project={pacerProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className: 'bg-lime-600 border-lime-600 hover:bg-lime-700 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={pacerProject.featureHighlights}
      />

      <FeatureGridSection
        title="Framework Agnostic & Feature Rich"
        description="TanStack Pacer's API is highly modular and framework-independent while still prioritizing ergonomics. Behold, the obligatory feature-list:"
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

      <MaintainersSection libraryId="pacer" />
      <PartnersSection libraryId="pacer" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-lime-600 border-lime-600 hover:bg-lime-700 hover:border-lime-700 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
