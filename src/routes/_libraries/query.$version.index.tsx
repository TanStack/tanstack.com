import * as React from 'react'

import { Link, getRouteApi } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { TbHeartHandshake } from 'react-icons/tb'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { SponsorsSection } from '~/components/SponsorsSection'
import { PartnersSection } from '~/components/PartnersSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { QueryGGBanner } from '~/components/QueryGGBanner'
import { queryProject } from '~/libraries/query'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { twMerge } from 'tailwind-merge'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { partners } from '~/utils/partners'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: VersionIndex,
  head: () => ({
    meta: seo({
      title: queryProject.name,
      description: queryProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('query')

export default function VersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(queryProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark] = React.useState(true)

  return (
    <div className="flex flex-1 flex-col min-h-0 relative overflow-x-hidden">
      <div className="flex flex-1 min-h-0 relative justify-center overflow-x-hidden">
        <div className="flex flex-col gap-20 md:gap-32 max-w-full py-32">
          <LibraryHero
            project={queryProject}
            cta={{
              linkProps: {
                from: '/$libraryId/$version',
                to: './docs',
                params: { libraryId: library.id },
              },
              label: 'Read the Docs',
              className: 'bg-red-500 text-white',
            }}
          />
          <div className="px-4">
            <QueryGGBanner />
          </div>

          <div className="w-fit mx-auto px-4">
            <OpenSourceStats library={library} />
          </div>
          <LibraryFeatureHighlights
            featureHighlights={library.featureHighlights}
          />

          <div className="px-4 sm:px-6 lg:px-8 mx-auto">
            <div className=" sm:text-center pb-16">
              <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
                No dependencies. All the Features.
              </h3>
              <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
                With zero dependencies, TanStack Query is extremely lean given
                the dense feature set it provides. From weekend hobbies all the
                way to enterprise e-commerce systems (Yes, I'm lookin' at you
                Walmart! 😉), TanStack Query is the battle-hardened tool to help
                you succeed at the speed of your creativity.
              </p>
            </div>
            <FeatureGrid
              title="No dependencies. All the Features."
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
          </div>

          {/* Trusted Marquee intentionally left as-is for Query page content differences */}

          <PartnersSection libraryId="query" />

          <SponsorsSection sponsorsPromise={sponsorsPromise} />

          <LandingPageGad />

          <div className="flex flex-col gap-4">
            <div className="px-4 sm:px-6 lg:px-8  mx-auto max-w-3xl sm:text-center">
              <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
                Less code, fewer edge cases.
              </h3>
              <p className="my-4 text-xl leading-7  text-gray-600">
                Instead of writing reducers, caching logic, timers, retry logic,
                complex async/await scripting (I could keep going...), you
                literally write a tiny fraction of the code you normally would.
                You will be surprised at how little code you're writing or how
                much code you're deleting when you use TanStack Query. Try it
                out with one of the examples below!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(
                  [
                    { label: 'Angular', value: 'angular' },
                    { label: 'React', value: 'react' },
                    { label: 'Solid', value: 'solid' },
                    { label: 'Svelte', value: 'svelte' },
                    { label: 'Vue', value: 'vue' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                      item.value === framework
                        ? 'bg-red-500'
                        : 'bg-gray-300 dark:bg-gray-700 hover:bg-red-300'
                    }`}
                    onClick={() => setFramework(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {[''].includes(framework) ? (
            <div className="px-2">
              <div className="p-8 text-center text-lg w-full max-w-(--breakpoint-lg) mx-auto bg-black text-white rounded-xl">
                Looking for the <strong>@tanstack/{framework}-query</strong>{' '}
                example? We could use your help to build the{' '}
                <strong>@tanstack/{framework}-query</strong> adapter! Join the{' '}
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
                repo={queryProject.repo}
                branch={branch}
                examplePath={`examples/${framework}/simple`}
                title={`tannerlinsley/${framework}-query: basic`}
              />
            </div>
          )}

          <BottomCTA
            linkProps={{
              from: '/$libraryId/$version',
              to: './docs',
              params: { libraryId: library.id },
            }}
            label="Read the Docs!"
            className="bg-red-500 text-white"
          />
          <Footer />
        </div>
      </div>
    </div>
  )
}
