import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { devtoolsProject } from '~/libraries/devtools'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { CheckCircleIcon } from '~/components/icons/CheckCircleIcon'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('devtools')

export default function DevtoolsLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero
        project={devtoolsProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className:
            'bg-slate-500 border-slate-500 hover:bg-slate-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={devtoolsProject.featureHighlights}
      />

      <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
        <div className="pb-8">
          <h3 className="text-3xl font-bold">Unified Development Experience</h3>
          <p className="mt-4 text-xl max-w-3xl leading-7 opacity-60">
            TanStack Devtools brings together all your development tools in one
            place, making debugging and development more efficient than ever
            before.
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
          ].map((d, i) => (
            <span key={i} className="flex items-center gap-2">
              <CheckCircleIcon className="text-green-500" /> {d}
            </span>
          ))}
        </div>
      </div>

      <MaintainersSection libraryId="devtools" />
      <PartnersSection libraryId="devtools" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-slate-500 border-slate-500 hover:bg-slate-600 hover:border-slate-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
