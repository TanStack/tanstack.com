import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { BottomCTA } from '~/components/BottomCTA'
import { FeatureGrid } from '~/components/FeatureGrid'
import { Footer } from '~/components/Footer'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LazyLandingCodeExample } from '~/components/LazyLandingCodeExample'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import LandingPageGad from '~/components/LandingPageGad'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { virtualProject } from '~/libraries/virtual'

const library = getLibrary('virtual')

export default function VirtualLanding() {
  const { version } = useParams({ strict: false })
  const [framework, setFramework] = useState<Framework>('react')
  const branch = getBranch(virtualProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={virtualProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className:
            'bg-purple-500 border-purple-500 hover:bg-purple-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <LazyLandingCodeExample libraryId="virtual" />

      <LibraryFeatureHighlights
        featureHighlights={virtualProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={virtualProject.testimonials} />

      <FeatureGrid
        title="Framework Agnostic & Feature Rich"
        items={[
          'Lightweight (10 - 15kb)',
          'Tree-Shaking',
          'Headless',
          'Vertical/Column Virtualization',
          'Horizontal/Row Virtualization',
          'Grid Virtualization',
          'Window-Scrolling',
          'Fixed Sizing',
          'Variable Sizing',
          'Dynamic/Measured Sizing',
          'Scrolling Utilities',
          'Sticky Items',
        ]}
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4 mx-auto"
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto container max-w-3xl">
          <h3 className="text-3xl font-bold">Take it for a spin!</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            With just a few divs and some inline styles, you're already well on
            your way to creating an extremely powerful virtualization
            experience.
          </p>
        </div>
      </div>

      <div className="px-4">
        <div className="relative w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-xl">
          <FrameworkIconTabs
            frameworks={virtualProject.frameworks}
            value={framework}
            onChange={setFramework}
          />
          {['vue', 'solid', 'svelte'].includes(framework) ? (
            <div className="p-6 text-center text-lg w-full bg-black text-white">
              Looking for the <strong>@tanstack/{framework}-virtual</strong>{' '}
              example? We could use your help to build the{' '}
              <strong>@tanstack/{framework}-virtual</strong> adapter! Join the{' '}
              <a
                href="https://tlinz.com/discord"
                className="text-teal-500 font-bold"
              >
                TanStack Discord Server
              </a>{' '}
              and let's get to work!
            </div>
          ) : (
            <StackBlitzEmbed
              repo={virtualProject.repo}
              branch={branch}
              examplePath={`examples/${framework}/fixed`}
              title="tannerlinsley/react-virtual: fixed"
            />
          )}
        </div>
      </div>

      <LazyLandingCommunitySection
        libraryId="virtual"
        libraryName="TanStack Virtual"
        showShowcases={false}
      />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-purple-500 border-purple-500 hover:bg-purple-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
