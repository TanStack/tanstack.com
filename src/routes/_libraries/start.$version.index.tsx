import * as React from 'react'

import { FaBook, FaGithub } from 'react-icons/fa'

import { Link, getRouteApi } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { SponsorsSection } from '~/components/SponsorsSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { startProject } from '~/libraries/start'
import { seo } from '~/utils/seo'
import { VscPreview } from 'react-icons/vsc'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'
import { TbBrandX } from 'react-icons/tb'

export const Route = createFileRoute({
  component: VersionIndex,
  head: () => ({
    meta: seo({
      title: startProject.name,
      description: startProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('start')

export default function VersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    if (isDark) {
      //
    }
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [isDark])

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={startProject}
        actions={
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              from={'/$libraryId/$version'}
              to={'./docs/framework/$framework/$'}
              params={{
                libraryId: library.id,
                framework: 'react',
                _splat: 'quick-start',
              }}
              hash={'impatient'}
              className={`py-2 px-4 bg-transparent text-cyan-600 dark:text-cyan-400 border-2 border-cyan-500 dark:border-cyan-600 rounded uppercase font-extrabold`}
            >
              Try it in 60 seconds
            </Link>
            <Link
              from="/$libraryId/$version"
              to="./docs"
              params={{ libraryId: library.id }}
              className={`py-2 px-4 bg-cyan-500 dark:bg-cyan-600 rounded text-white uppercase font-extrabold flex items-center`}
            >
              Get Started
            </Link>
          </div>
        }
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>

      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />

      <div className="space-y-8 px-4">
        <div className="font-black text-3xl mr-1 text-center">
          When can I use it?
        </div>
        <div className="max-w-full p-8 w-[800px] mx-auto leading-loose space-y-4 bg-white dark:bg-black/40 rounded-xl shadow-xl shadow-black/10">
          <div>
            You can use <strong>TanStack Start BETA</strong> today! Although
            currently in active development, we do not expect any more breaking
            changes. We invite you to provide feedback to help us on the journey
            to 1.0! If you choose to ship a BETA Start app to production, we
            recommend locking your dependencies to a specific version and
            keeping up with the latest releases.
          </div>
        </div>
        <div className="grid items-center gap-2 justify-center grid-cols-1 sm:grid-cols-2 w-[600px] max-w-full mx-auto">
          <Link
            from={'/$libraryId/$version'}
            to="./docs/framework/$framework/examples/$"
            params={{
              libraryId: library.id,
              framework: 'react',
              _splat: 'start-basic',
            }}
            className="flex items-center gap-2 py-2 px-4 bg-cyan-900 rounded text-white uppercase font-extrabold"
          >
            <VscPreview className="min-w-4" /> See an Example
          </Link>
          <Link
            from={'/$libraryId/$version'}
            to="./docs"
            params={{ libraryId: library.id }}
            className="flex items-center gap-2 py-2 px-4 bg-cyan-800 rounded text-white uppercase font-extrabold"
          >
            <FaBook className="min-w-4" /> Try the BETA
          </Link>
          <a
            href={`https://github.com/tanstack/tanstack.com`}
            className={`flex items-center gap-2 py-2 px-4 bg-cyan-700 rounded text-white uppercase font-extrabold`}
          >
            <FaGithub className="min-w-4" /> TanStack.com Source
          </a>
          <a
            href={`https://twitter.com/intent/post?text=${encodeURIComponent(
              `TanStack Start is in BETA! It's a new full-stack React framework from @Tan_Stack and you can check it out at https://tanstack.com/start/`
            )}`}
            target="_blank"
            className="flex items-center gap-2 py-2 px-4 bg-cyan-500 rounded text-white uppercase font-extrabold"
            rel="noreferrer"
          >
            <TbBrandX className="min-w-4" /> Tweet about it!
          </a>{' '}
        </div>
      </div>

      {/* <div
        className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
      >
        <div className="flex-1 flex flex-col gap-8 items-center">
          <VscWand className="text-cyan-500 text-6xl" />
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Built on TanStack Router
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Writing your data fetching logic by hand is over. Tell TanStack
              Query where to get your data and how fresh you need it to be and
              the rest is automatic. It handles{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                caching, background updates and stale data out of the box with
                zero-configuration
              </span>
              .
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaBolt className="text-sky-600 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Simple & Familiar
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              If you know how to work with promises or async/await, then you
              already know how to use TanStack Query. There's{' '}
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                no global state to manage, reducers, normalization systems or
                heavy configurations to understand
              </span>
              . Simply pass a function that resolves your data (or throws an
              error) and the rest is history.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaCogs className="text-blue-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Extensible
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              TanStack Query is configurable down to each observer instance of a
              query with knobs and options to fit every use-case. It comes wired
              up with{' '}
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                dedicated devtools, infinite-loading APIs, and first class
                mutation tools that make updating your data a breeze
              </span>
              . Don't worry though, everything is pre-configured for success!
            </p>
          </div>
        </div>
      </div> */}

      {/* <div className="px-4 sm:px-6 lg:px-8 mx-auto">
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            No dependencies. All the Features.
          </h3>
          <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
            With zero dependencies, TanStack Query is extremely lean given the
            dense feature set it provides. From weekend hobbies all the way to
            enterprise e-commerce systems (Yes, I'm lookin' at you Walmart! 😉),
            TanStack Query is the battle-hardened tool to help you succeed at
            the speed of your creativity.
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4  mx-auto">
          {[
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
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 " /> {d}
              </span>
            )
          })}
        </div>
      </div> */}

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
                  'Google',
                  'Walmart',
                  'Facebook',
                  'PayPal',
                  'Amazon',
                  'American Express',
                  'Microsoft',
                  'Target',
                  'Ebay',
                  'Autodesk',
                  'CarFAX',
                  'Docusign',
                  'HP',
                  'MLB',
                  'Volvo',
                  'Ocado',
                  'UPC.ch',
                  'EFI.com',
                  'ReactBricks',
                  'Nozzle.io',
                  'Uber',
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

      <PartnersSection libraryId="start" />

      <SponsorsSection sponsorsPromise={sponsorsPromise} />

      <LandingPageGad />

      {/* <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Less code, fewer edge cases.
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            Instead of writing reducers, caching logic, timers, retry logic,
            complex async/await scripting (I could keep going...), you literally
            write a tiny fraction of the code you normally would. You will be
            surprised at how little code you're writing or how much code you're
            deleting when you use TanStack Query. Try it out with one of the
            examples below!
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
                    ? 'bg-cyan-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-cyan-300'
                }`}
                onClick={() => setFramework(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div> */}

      {/* {[''].includes(framework) ? (
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
          <iframe
            key={framework}
            src={`https://stackblitz.com/github/${repo}/tree/${branch}/examples/${framework}/simple?embed=1&theme=${
              isDark ? 'dark' : 'light'
            }`}
            title={`tannerlinsley/${framework}-query: basic`}
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            className="shadow-2xl"
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
        className="bg-cyan-500 text-white"
      />
      <Footer />
    </div>
  )
}
