import { useParams } from '@tanstack/react-router'
import { BottomCTA } from '~/components/BottomCTA'
import { FeatureGrid } from '~/components/FeatureGrid'
import { Footer } from '~/components/Footer'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LazyLandingCodeExample } from '~/components/LazyLandingCodeExample'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import LandingPageGad from '~/components/LandingPageGad'
import { StackBlitzSection } from '~/components/StackBlitzSection'
import { getBranch, getLibrary } from '~/libraries'
import { formProject } from '~/libraries/form'

const library = getLibrary('form')

export default function FormLanding() {
  const { version } = useParams({ strict: false })
  const branch = getBranch(formProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={formProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className:
            'bg-yellow-400 border-yellow-400 hover:bg-yellow-500 text-black',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={formProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={formProject.testimonials} />

      <LazyLandingCodeExample libraryId="form" />

      <FeatureGrid
        title="No dependencies. All the Features."
        items={[
          'Framework agnostic design',
          'First Class TypeScript Support',
          'Headless',
          'Tiny / Zero Deps',
          'Granularly Reactive Components/Hooks',
          'Extensibility and plugin architecture',
          'Modular architecture',
          'Form/Field validation',
          'Async Validation',
          'Built-in Async Validation Debouncing',
          'Configurable Validation Events',
          'Deeply Nested Object/Array Fields',
        ]}
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto container max-w-3xl">
          <h3 className="text-3xl font-bold">Less code, fewer edge cases.</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            Instead of encouraging hasty abstractions and hook-focused APIs,
            TanStack Form embraces composition where it counts by giving you
            headless APIs via components (and hooks if you want them of course).
            TanStack Form is designed to be used directly in your components and
            UI. This means less code, fewer edge cases, and deeper control over
            your UI. Try it out with one of the examples below!
          </p>
        </div>
      </div>

      <StackBlitzSection
        project={formProject}
        branch={branch}
        examplePath="examples/${framework}/simple"
        title={(framework) => `tanstack//${framework}-form: simple`}
      />

      <LazyLandingCommunitySection
        libraryId="form"
        libraryName="TanStack Form"
      />

      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-yellow-500 border-yellow-500 hover:bg-yellow-600 text-black"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
