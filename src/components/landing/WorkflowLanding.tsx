import { BottomCTA } from '~/components/BottomCTA'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { getLibrary } from '~/libraries'
import { workflowProject } from '~/libraries/workflow'

const library = getLibrary('workflow')

export default function WorkflowLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero project={workflowProject} />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={workflowProject.featureHighlights}
      />

      <LazyLandingCommunitySection
        libraryId="workflow"
        libraryName="TanStack Workflow"
        showShowcases={false}
      />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId',
          params: { libraryId: library.id },
        }}
        label="Explore Workflow"
        className="bg-blue-800 border-blue-800 hover:bg-blue-900 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
