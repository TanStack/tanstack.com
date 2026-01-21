import { Link } from '@tanstack/react-router'
import { Layers } from 'lucide-react'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { cliProject } from '~/libraries/cli'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { Button } from '~/ui'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('cli')

export default function CliLanding() {
  return (
    <LibraryPageContainer>
      <LibraryHero
        project={cliProject}
        actions={
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              as={Link}
              to="/builder"
              className="bg-transparent border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
            >
              <Layers className="w-4 h-4" />
              Try the Builder
            </Button>
            <Button
              as="a"
              href="/cli/latest/docs"
              className="bg-indigo-500 border-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:border-indigo-600 text-white"
            >
              Get Started
            </Button>
          </div>
        }
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={cliProject.featureHighlights}
      />

      <MaintainersSection libraryId="cli" />
      <PartnersSection libraryId="cli" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-indigo-500 border-indigo-500 hover:bg-indigo-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
