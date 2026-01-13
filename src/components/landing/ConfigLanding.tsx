import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { configProject } from '~/libraries/config'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { Button } from '~/components/Button'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { CheckCircleIcon } from '~/components/icons/CheckCircleIcon'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('config')

export default function ConfigLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero
        project={configProject}
        actions={
          <Button
            as="a"
            href={`/config/latest/docs`}
            className="bg-gray-500 border-gray-500 hover:bg-gray-600 text-white"
          >
            Get Started
          </Button>
        }
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={configProject.featureHighlights}
      />

      <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
        <div className="pb-8">
          <h3 className="text-3xl font-bold">Hassle-Free Setup</h3>
          <p className="mt-4 text-xl max-w-3xl leading-7 opacity-60">
            Incorporate TanStack Config into your development toolkit and
            experience a new level of efficiency, speed, and customization in
            building and releasing high-quality JavaScript packages.
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-max mx-auto">
          {[
            'Vite ecosystem',
            'Opinionated defaults',
            'Publint-compliant',
            'Minimal configuration',
            'Package versioning',
            'Automated changelogs',
          ].map((d, i) => (
            <span key={i} className="flex items-center gap-2">
              <CheckCircleIcon className="text-green-500" /> {d}
            </span>
          ))}
        </div>
      </div>

      <MaintainersSection libraryId="config" />
      <PartnersSection libraryId="config" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-gray-500 border-gray-500 hover:bg-gray-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
