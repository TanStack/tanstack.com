import * as React from 'react'
import { routerProject } from '~/libraries/router'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { PartnersSection } from '~/components/PartnersSection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import { CodeBlock } from '~/components/Markdown'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BottomCTA } from '~/components/BottomCTA'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import OpenSourceStats from '~/components/OpenSourceStats'
import { ossStatsQuery } from '~/queries/stats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'

const library = getLibrary('router')

export const Route = createFileRoute('/_libraries/router/$version/')({
  component: RouterVersionIndex,
  head: () => ({
    meta: seo({
      title: routerProject.name,
      description: routerProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function RouterVersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()
  const branch = getBranch(routerProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={routerProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className: 'bg-emerald-500 text-white',
        }}
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>

      {/* Minimal code example card */}
      <div className="px-4 space-y-4 flex flex-col items-center ">
        <div className="text-3xl font-black">Just a quick look...</div>
        <div className="group relative bg-white/50 dark:bg-black/40 rounded-lg overflow-hidden shadow-xl max-w-full mx-auto [&_pre]:bg-transparent! [&_pre]:p-4!">
          <div>
            <FrameworkIconTabs
              frameworks={routerProject.frameworks}
              value={framework}
              onChange={setFramework}
            />
          </div>
          {(() => {
            const codeByFramework: Partial<
              Record<Framework, { lang: string; code: string }>
            > = {
              react: {
                lang: 'tsx',
                code: `import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'

const rootRoute = createRootRoute()
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Hello World</div>,
})
const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

export default function App() {
  return <RouterProvider router={router} />
}`,
              },
              solid: {
                lang: 'tsx',
                code: `import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/solid-router'

const rootRoute = createRootRoute()
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Hello World</div>,
})
const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

export default function App() {
  return <RouterProvider router={router} />
}`,
              },
            }

            const selected =
              codeByFramework[framework] || codeByFramework.react!

            return (
              <CodeBlock
                className="mt-0 border-0"
                showTypeCopyButton={false as any}
              >
                <code className={`language-${selected.lang}`}>
                  {selected.code}
                </code>
              </CodeBlock>
            )
          })()}
          <div className="mt-4 text-center">
            <Link
              to="/$libraryId/$version/docs"
              params={{ libraryId: library.id, version }}
              className="inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors bg-emerald-500 text-white"
            >
              Get Started
            </Link>
          </div>
        </div>
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

      <LazySponsorSection />

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

        <div className="px-4">
          <div className="relative w-full bg-white/50 dark:bg-black/50 rounded-lg overflow-hidden shadow-xl">
            <div className="">
              <FrameworkIconTabs
                frameworks={routerProject.frameworks}
                value={framework}
                onChange={setFramework}
              />
            </div>
            <StackBlitzEmbed
              repo={routerProject.repo}
              branch={branch}
              examplePath={`examples/${framework}/kitchen-sink-file-based`}
              file={'src/main.tsx'}
              title="tannerlinsley/router: kitchen-sink"
            />
          </div>
        </div>
      </div>

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-emerald-500 text-white"
      />
      <Footer />
    </div>
  )
}
