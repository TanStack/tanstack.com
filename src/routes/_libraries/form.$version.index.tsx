import * as React from 'react'

import { Link, getRouteApi } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { formProject } from '~/libraries/form'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { twMerge } from 'tailwind-merge'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { SponsorsSection } from '~/components/SponsorsSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: FormVersionIndex,
  head: () => ({
    meta: seo({
      title: formProject.name,
      description: formProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('form')

export default function FormVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(formProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark] = React.useState(true)

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <LibraryHero
          project={formProject}
          cta={{
            linkProps: {
              from: '/$libraryId/$version',
              to: './docs',
              params: { libraryId: library.id },
            },
            label: 'Get Started',
            className: 'bg-yellow-400 text-black',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

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

        <PartnersSection libraryId="form" />

        <SponsorsSection sponsorsPromise={sponsorsPromise} />

        <LandingPageGad />

        <div className="flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
            <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
              Less code, fewer edge cases.
            </h3>
            <p className="my-4 text-xl leading-7  text-gray-600">
              Instead of encouraging hasty abstractions and hook-focused APIs,
              TanStack Form embraces composition where it counts by giving you
              headless APIs via components (and hooks if you want them of
              course). TanStack Form is designed to be used directly in your
              components and UI. This means less code, fewer edge cases, and
              deeper control over your UI. Try it out with one of the examples
              below!
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(
                [
                  { label: 'React', value: 'react' },
                  { label: 'Vue', value: 'vue' },
                  { label: 'Angular', value: 'angular' },
                  { label: 'Solid', value: 'solid' },
                  { label: 'Lit', value: 'lit' },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  className={`inline-block py-2 px-4 rounded text-black uppercase font-extrabold ${
                    item.value === framework
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-yellow-400'
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
            repo={formProject.repo}
            branch={branch}
            examplePath={`examples/${framework}/simple`}
            title={`tanstack//${framework}-form: simple`}
          />
        </div>

        <BottomCTA
          linkProps={{
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          }}
          label="Get Started!"
          className="bg-yellow-500 text-black"
        />
        <Footer />
      </div>
    </>
  )
}
