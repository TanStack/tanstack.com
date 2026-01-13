import { createFileRoute, Link } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { mcpProject } from '~/libraries/mcp'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { seo } from '~/utils/seo'
import LandingPageGad from '~/components/LandingPageGad'
import { Button } from '~/components/Button'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { Key } from 'lucide-react'

const library = getLibrary('mcp')

export const Route = createFileRoute('/_libraries/mcp/$version/')({
  component: McpVersionIndex,
  head: () => ({
    meta: seo({
      title: mcpProject.name,
      description: mcpProject.description,
      noindex: library.visible === false,
    }),
  }),
})

function McpVersionIndex() {
  const canApiKeys = true // Any logged-in user can access API keys

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={mcpProject}
        actions={
          <>
            <Button
              as="a"
              href={`/mcp/latest/docs`}
              className="bg-black dark:bg-white border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black"
            >
              Get Started
            </Button>
            {canApiKeys && (
              <Button as={Link} to="/account/integrations">
                <Key className="w-3.5 h-3.5" />
                Get API Key
              </Button>
            )}
          </>
        }
      />

      <LibraryFeatureHighlights
        featureHighlights={mcpProject.featureHighlights}
      />

      <MaintainersSection libraryId="mcp" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-black dark:bg-white border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
