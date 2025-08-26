import * as React from 'react'

import { getRouteApi } from '@tanstack/react-router'
import { virtualProject } from '~/libraries/virtual'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { SponsorsSection } from '~/components/SponsorsSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { Framework, getBranch } from '~/libraries'
import { seo } from '~/utils/seo'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: virtualProject.name,
      description: virtualProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('virtual')

export default function RouteComp() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const [framework, setFramework] = React.useState<Framework>('react')
  const branch = getBranch(virtualProject, version)
  const [isDark] = React.useState(true)

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={virtualProject}
        cta={{
          linkProps: {
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className: 'bg-purple-500 text-white',
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
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4  mx-auto"
      />

      {/* <div>
        <div className="uppercase tracking-wider text-sm font-semibold text-center text-gray-400 mb-3">
          Trusted in Production by
        </div>
        <marquee scrollamount="2">
          <div className="flex gap-2 items-center text-3xl font-bold ml-[-100%]">
            {(new Array(4) as string[])
              .fill('')
              .reduce(
                (all) => [...all, ...all],
                [
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
                ]
              )
              .map((d, i) => (
                <span key={i} className="opacity-70 even:opacity-40">
                  {d}
                </span>
              ))}
          </div>
        </marquee>
      </div> */}

      <PartnersSection libraryId="virtual" />

      <SponsorsSection sponsorsPromise={sponsorsPromise} />

      <LandingPageGad />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            With just a few divs and some inline styles, you're already well on
            your way to creating an extremely powerful virtualization
            experience.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {(
              [
                { label: 'React', value: 'react' },
                { label: 'Solid', value: 'solid' },
                { label: 'Lit', value: 'lit' },
                { label: 'Svelte', value: 'svelte' },
                { label: 'Vue', value: 'vue' },
                { label: 'Angular', value: 'angular' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                  item.value === framework
                    ? 'bg-purple-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-teal-300'
                }`}
                onClick={() => setFramework(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {['vue', 'solid', 'svelte'].includes(framework) ? (
        <div className="px-2">
          <div className="p-8 text-center text-lg w-full max-w-(--breakpoint-lg) mx-auto bg-black text-white rounded-xl">
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
        </div>
      ) : (
        <div className="bg-white dark:bg-black">
          <StackBlitzEmbed
            repo={virtualProject.repo}
            branch={branch}
            examplePath={`examples/${framework}/fixed`}
            title="tannerlinsley/react-virtual: fixed"
          />
        </div>
      )}

      <BottomCTA
        linkProps={{
          from: '/$libraryId/$version',
          to: './docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-purple-500 text-white"
      />
      <Footer />
    </div>
  )
}
