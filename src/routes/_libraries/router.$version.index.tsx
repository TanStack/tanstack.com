import * as React from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { routerProject } from '~/libraries/router'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { PartnersSection } from '~/components/PartnersSection'
import { SponsorsSection } from '~/components/SponsorsSection'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { BottomCTA } from '~/components/BottomCTA'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: RouterVersionIndex,
  head: () => ({
    meta: seo({
      title: routerProject.name,
      description: routerProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('router')

function RouterVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(routerProject, version)
  const [framework] = React.useState<Framework>('react')
  const [isDark] = React.useState(true) // deprecated – using StackBlitzEmbed theme

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={routerProject}
        cta={{
          linkProps: {
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          },
          label: 'Get Started',
          className: 'bg-emerald-500 text-white',
        }}
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>

      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />
      <PartnersSection libraryId="router" />

      <FeatureGrid
        title="Feature Rich and Lightweight"
        items={[
          '100% Typesafe',
          'Parallel Route Loaders',
          '1st-class Search Param APIs',
          'Nested/Layout Routes',
          'Lightweight (12kb)',
          'Suspense + Transitions',
          'Strict Navigation',
          'Auto-completed Paths',
          'Search Param Schemas',
          'Search Param Validation',
          'Search Param Parsing + Serialization',
          'Search Param Pre/Post Processing',
          'Structural Sharing',
          'Automatic Prefetching',
          'Asynchronous Elements',
          'Pending Elements',
          'Error Boundaries',
        ]}
      />

      <SponsorsSection sponsorsPromise={sponsorsPromise} />

      <LandingPageGad />

      <div>
        <div className="flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8 mx-auto max-w-3xl sm:text-center">
            <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
              Take it for a spin!
            </h3>
            <p className="my-4 text-xl leading-7  text-gray-600">
              Create a route, pop in a Router, and start slingin' some code!
            </p>
            {/* <div className="flex flex-wrap gap-2 justify-center">
            {(
              [
                { label: 'React', value: 'react' },
                { label: 'Preact', value: 'preact' },
                { label: 'Solid', value: 'solid' },
                { label: 'Vue', value: 'vue' },
                { label: 'Svelte', value: 'svelte' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                  item.value === framework
                    ? 'bg-teal-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-teal-300'
                }`}
                onClick={() => setFramework(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div> */}
          </div>
        </div>

        {/* {['preact', 'vue', 'solid', 'svelte'].includes(framework) ? (
        <div className="px-2">
          <div className="p-8 text-center text-lg w-full max-w-(--breakpoint-lg) mx-auto bg-black text-white rounded-xl">
            Looking for the <strong>@tanstack/{framework}-router</strong>{' '}
            example? The <strong>@tanstack/{framework}-router</strong> adapter
            is currently under development! Join the{' '}
            <a
              href="https://tlinz.com/discord"
              className="text-teal-500 font-bold"
            >
              TanStack Discord Server
            </a>{' '}
            and help us make routing in {framework} a better place!
          </div>
        </div>
      ) : ( */}
        <div className="bg-white dark:bg-black">
          <StackBlitzEmbed
            repo={routerProject.repo}
            branch={branch}
            examplePath={`examples/${framework}/kitchen-sink-file-based`}
            file={'src/main.tsx'}
            title="tannerlinsley/router: kitchen-sink"
          />
        </div>
      </div>

      <BottomCTA
        linkProps={{
          from: '/$libraryId/$version',
          to: './docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-emerald-500 text-white"
      />
      <Footer />
    </div>
  )
}
