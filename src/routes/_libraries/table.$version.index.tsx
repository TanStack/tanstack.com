import * as React from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { tableProject } from '~/libraries/table'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { TrustedByMarquee } from '~/components/TrustedByMarquee'
import { PartnersSection } from '~/components/PartnersSection'
import { SponsorsSection } from '~/components/SponsorsSection'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { BottomCTA } from '~/components/BottomCTA'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { getExampleStartingPath } from '~/utils/sandbox'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: TableVersionIndex,
  head: () => ({
    meta: seo({
      title: tableProject.name,
      description: tableProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('table')

export default function TableVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(tableProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const sandboxFirstFileName = getExampleStartingPath(framework)

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={tableProject}
        cta={{
          linkProps: {
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className: 'bg-blue-500 text-white',
        }}
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>

      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />

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
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4  mx-auto"
      />

      <TrustedByMarquee
        brands={[
          'Intuit',
          'Google',
          'Amazon',
          'Apple',
          'AutoZone',
          'Microsoft',
          'Cisco',
          'Uber',
          'Salesforce',
          'Walmart',
          'Wix',
          'HP',
          'Docusign',
          'Tripwire',
          'Yahoo!',
          'Ocado',
          'Nordstrom',
          'TicketMaster',
          'Comcast Business',
          'Nozzle.io',
        ]}
      />

      <PartnersSection libraryId="table" />

      <SponsorsSection sponsorsPromise={sponsorsPromise} />

      <LandingPageGad />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            With some basic styles, some table markup and few columns, you're
            already well on your way to creating a drop-dead powerful table.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {(
              [
                { label: 'Angular', value: 'angular' },
                { label: 'Lit', value: 'lit' },
                { label: 'Qwik', value: 'qwik' },
                { label: 'React', value: 'react' },
                { label: 'Solid', value: 'solid' },
                { label: 'Svelte', value: 'svelte' },
                { label: 'Vue', value: 'vue' },
                { label: 'Vanilla', value: 'vanilla' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                  item.value === framework
                    ? 'bg-rose-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-rose-300'
                }`}
                onClick={() => setFramework(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-black">
        <StackBlitzEmbed
          repo={tableProject.repo}
          branch={branch}
          examplePath={`examples/${framework}/basic`}
          file={sandboxFirstFileName}
          title="tannerlinsley/react-table: basic"
        />
      </div>

      <BottomCTA
        linkProps={{
          from: '/$libraryId/$version',
          to: './docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-teal-500 text-white"
      />
      <Footer />
    </div>
  )
}
