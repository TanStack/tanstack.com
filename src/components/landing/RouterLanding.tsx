import { useParams } from '@tanstack/react-router'
import { routerProject } from '~/libraries/router'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LibraryShowcases } from '~/components/ShowcaseSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { CodeExampleCard } from '~/components/CodeExampleCard'
import { StackBlitzSection } from '~/components/StackBlitzSection'

const library = getLibrary('router')

const codeExamples: Partial<Record<Framework, { lang: string; code: string }>> =
  {
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

export default function RouterLanding() {
  const { version } = useParams({ strict: false })
  const branch = getBranch(routerProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={routerProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className:
            'bg-emerald-500 border-emerald-500 hover:bg-emerald-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <CodeExampleCard
        frameworks={routerProject.frameworks}
        codeByFramework={codeExamples}
      />

      <LibraryFeatureHighlights
        featureHighlights={routerProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={routerProject.testimonials} />

      <MaintainersSection libraryId="router" />
      <PartnersSection libraryId="router" />

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <LibraryShowcases libraryId="router" libraryName="TanStack Router" />
      </div>

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

      <div>
        <div className="flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8 mx-auto max-w-3xl">
            <h3 className="text-3xl font-bold">Take it for a spin!</h3>
            <p className="my-4 text-xl leading-7 text-gray-600">
              Create a route, pop in a Router, and start slingin' some code!
            </p>
          </div>
        </div>

        <StackBlitzSection
          project={routerProject}
          branch={branch}
          examplePath="examples/${framework}/kitchen-sink-file-based"
          title="tannerlinsley/router: kitchen-sink"
        />
      </div>

      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-emerald-500 border-emerald-500 hover:bg-emerald-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
