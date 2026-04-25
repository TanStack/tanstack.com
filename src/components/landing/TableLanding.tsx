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
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import LandingPageGad from '~/components/LandingPageGad'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { tableProject } from '~/libraries/table'
import type { LandingComponentProps } from '~/routes/$libraryId/$version'
import { getExampleStartingPath } from '~/utils/sandbox'

const library = getLibrary('table')

export default function TableLanding({
  landingCodeExampleRsc,
}: LandingComponentProps) {
  const { version } = useParams({ strict: false })
  const branch = getBranch(tableProject, version)
  const [framework, setFramework] = useState<Framework>('react')
  const sandboxFirstFileName = getExampleStartingPath(framework)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={tableProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className: 'bg-blue-500 border-blue-500 hover:bg-blue-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      {landingCodeExampleRsc}

      <LibraryFeatureHighlights
        featureHighlights={tableProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={tableProject.testimonials} />

      <FeatureGrid
        title="Framework Agnostic & Feature Rich"
        items={[
          'Lightweight (10 - 15kb)',
          'Tree-Shaking',
          'Headless',
          'Cell Formatters',
          'Auto-managed internal state',
          'Opt-in fully controlled state',
          'Sorting',
          'Multi Sort',
          'Global Filters',
          'Columns Filters',
          'Pagination',
          'Row Grouping',
          'Aggregation',
          'Row Selection',
          'Row Expansion',
          'Column Ordering',
          'Column Visibility',
          'Column Resizing',
          'Virtualizable',
          'Server-side/external Data',
          'Nested/Grouped Headers',
          'Footers',
        ]}
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4 mx-auto"
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto container max-w-3xl">
          <h3 className="text-3xl font-bold">Take it for a spin!</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            With some basic styles, some table markup and few columns, you're
            already well on your way to creating a drop-dead powerful table.
          </p>
        </div>
      </div>

      <div className="px-4">
        <div className="relative w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-xl">
          <FrameworkIconTabs
            frameworks={tableProject.frameworks}
            value={framework}
            onChange={setFramework}
          />
          <StackBlitzEmbed
            repo={tableProject.repo}
            branch={branch}
            examplePath={`examples/${framework}/basic`}
            file={sandboxFirstFileName}
            title="tannerlinsley/react-table: basic"
          />
        </div>
      </div>

      <LazyLandingCommunitySection
        libraryId="table"
        libraryName="TanStack Table"
      />

      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-teal-500 border-teal-500 hover:bg-teal-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
