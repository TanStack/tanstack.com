import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { intentProject } from '~/libraries/intent'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('intent')

export default function IntentLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero project={intentProject} />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={intentProject.featureHighlights}
      />

      <MaintainersSection libraryId="intent" />
      <PartnersSection libraryId="intent" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-sky-500 border-sky-500 hover:bg-sky-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
