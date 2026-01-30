import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { storeProject } from '~/libraries/store'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('store')

export default function StoreLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero
        project={storeProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className:
            'bg-stone-600 border-stone-600 hover:bg-stone-700 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={storeProject.featureHighlights}
      />

      <MaintainersSection libraryId="store" />
      <PartnersSection libraryId="store" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-stone-700 border-stone-700 hover:bg-stone-800 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
