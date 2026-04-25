import { useParams } from '@tanstack/react-router'
import { BottomCTA } from '~/components/BottomCTA'
import { DeferredApplicationStarter } from '~/components/DeferredApplicationStarter'
import { FeatureGrid } from '~/components/FeatureGrid'
import { Footer } from '~/components/Footer'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import LandingPageGad from '~/components/LandingPageGad'
import { StackBlitzSection } from '~/components/StackBlitzSection'
import { getBranch, getLibrary } from '~/libraries'
import { routerProject } from '~/libraries/router'
import type { LandingComponentProps } from '~/routes/$libraryId/$version'

const library = getLibrary('router')

export default function RouterLanding({
  landingCodeExampleRsc,
}: LandingComponentProps) {
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

      <div className="space-y-6">
        <div className="mx-auto w-full max-w-[1021px] px-4 pt-4 sm:px-6">
          <div className="mx-auto">
            <DeferredApplicationStarter
              context="router"
              forceRouterOnly
              secondaryActionLabel="Build Router App on Netlify"
              suggestionContext="start"
              title="What would you like to build with TanStack Router?"
              tone="emerald"
            />
          </div>
        </div>
        <LibraryStatsSection library={library} />
      </div>

      {landingCodeExampleRsc}

      <LibraryFeatureHighlights
        featureHighlights={routerProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={routerProject.testimonials} />

      <LazyLandingCommunitySection
        libraryId="router"
        libraryName="TanStack Router"
      />

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
