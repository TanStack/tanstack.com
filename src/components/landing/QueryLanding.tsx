import { useParams } from '@tanstack/react-router'
import { BottomCTA } from '~/components/BottomCTA'
import { Footer } from '~/components/Footer'
import { FeatureGridSection } from '~/components/FeatureGridSection'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import LandingPageGad from '~/components/LandingPageGad'
import { QueryGGBanner } from '~/components/QueryGGBanner'
import { StackBlitzSection } from '~/components/StackBlitzSection'
import { getBranch, getLibrary } from '~/libraries'
import { queryProject } from '~/libraries/query'
import type { LandingComponentProps } from '~/routes/$libraryId/$version'

const library = getLibrary('query')

export default function QueryLanding({
  landingCodeExampleRsc,
}: LandingComponentProps) {
  const { version } = useParams({ strict: false })
  const branch = getBranch(queryProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={queryProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Read the Docs',
          className: 'bg-red-500 border-red-500 hover:bg-red-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      {landingCodeExampleRsc}

      <LibraryFeatureHighlights
        featureHighlights={queryProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={queryProject.testimonials} />

      <FeatureGridSection
        title="No dependencies. All the Features."
        description="With zero dependencies, TanStack Query is extremely lean given the dense feature set it provides. From weekend hobbies all the way to enterprise e-commerce systems (Yes, I'm lookin' at you Walmart!), TanStack Query is the battle-hardened tool to help you succeed at the speed of your creativity."
        items={[
          'Backend agnostic',
          'Dedicated Devtools',
          'Auto Caching',
          'Auto Refetching',
          'Window Focus Refetching',
          'Polling/Realtime Queries',
          'Parallel Queries',
          'Dependent Queries',
          'Mutations API',
          'Automatic Garbage Collection',
          'Paginated/Cursor Queries',
          'Load-More/Infinite Scroll Queries',
          'Scroll Recovery',
          'Request Cancellation',
          'Suspense Ready!',
          'Render-as-you-fetch',
          'Prefetching',
          'Variable-length Parallel Queries',
          'Offline Support',
          'SSR Support',
          'Data Selectors',
        ]}
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto max-w-3xl">
          <h3 className="text-3xl font-bold">Less code, fewer edge cases.</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            Instead of writing reducers, caching logic, timers, retry logic,
            complex async/await scripting (I could keep going...), you literally
            write a tiny fraction of the code you normally would. You will be
            surprised at how little code you're writing or how much code you're
            deleting when you use TanStack Query. Try it out with one of the
            examples below!
          </p>
        </div>
      </div>

      <StackBlitzSection
        project={queryProject}
        branch={branch}
        examplePath="examples/${framework}/simple"
        title={(framework) => `tannerlinsley/${framework}-query: basic`}
      />

      <LazyLandingCommunitySection
        libraryId="query"
        libraryName="TanStack Query"
      />

      <div className="px-4">
        <QueryGGBanner />
      </div>

      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Read the Docs!"
        className="bg-red-500 border-red-500 hover:bg-red-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
