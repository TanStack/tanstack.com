import { getRouteApi } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { SponsorsSection } from '~/components/SponsorsSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { storeProject } from '~/libraries/store'
import { seo } from '~/utils/seo'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'

export const Route = createFileRoute({
  component: StoreVersionIndex,
  head: () => ({
    meta: seo({
      title: storeProject.name,
      description: storeProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')
const library = getLibrary('store')

export default function StoreVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <LibraryHero
          project={storeProject}
          cta={{
            linkProps: {
              from: '/$libraryId/$version',
              to: './docs',
              params: { libraryId: library.id },
            },
            label: 'Get Started',
            className: 'bg-stone-600 text-white',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />
        <PartnersSection libraryId="store" />

        <SponsorsSection sponsorsPromise={sponsorsPromise} />

        <LandingPageGad />

        {/* <div className="flex flex-col gap-4">
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
                  { label: 'Solid', value: 'solid' },
                  { label: 'Svelte', value: 'svelte' },
                  { label: 'Vue', value: 'vue' },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  className={`inline-block py-2 px-4 rounded text-black uppercase font-extrabold ${
                    item.value === framework
                      ? 'bg-gray-500'
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'
                  }`}
                  onClick={() => setFramework(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {['solid', 'vue', 'svelte'].includes(framework) ? (
          <div className="px-2">
            <div className="p-8 text-center text-lg w-full max-w-(--breakpoint-lg) mx-auto bg-black text-white rounded-xl">
              Looking for the <strong>@tanstack/{framework}-form</strong>{' '}
              example? We could use your help to build the{' '}
              <strong>@tanstack/{framework}-form</strong> adapter! Join the{' '}
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
            <iframe
              key={framework}
              src={`https://stackblitz.com/github/${repo}/tree/${branch}/examples/${framework}/simple?embed=1&theme=${
                isDark ? 'dark' : 'light'
              }`}
              title={`tanstack//${framework}-form: simple`}
              sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              className="shadow-2xl max-h-[800px]"
              loading="lazy"
              style={{
                width: '100%',
                height: '80vh',
                border: '0',
              }}
            ></iframe>
          </div>
        )} */}

        <BottomCTA
          linkProps={{
            from: '/$libraryId/$version',
            to: './docs',
            params: { libraryId: library.id },
          }}
          label="Get Started!"
          className="bg-stone-700 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
