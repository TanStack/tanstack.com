import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { getLibrary } from '~/libraries'
import { startProject } from '~/libraries/start'
import { partners } from '~/utils/partners'
import { seo } from '~/utils/seo'
import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaBook, FaGithub, FaTwitter } from 'react-icons/fa'
import { VscPreview } from 'react-icons/vsc'
import { twMerge } from 'tailwind-merge'

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

  const gradientText = `pr-1 text-transparent bg-clip-text bg-gradient-to-r ${startProject.colorFrom} ${startProject.colorTo}`

  return (
    <div className="flex max-w-full flex-col gap-20 pt-32 md:gap-32">
      <div className="flex flex-col items-center gap-8 px-4 text-center">
        <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
          <span>TanStack</span>
          <span className={twMerge(gradientText)}>Start</span>
        </h1>
        {/* <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[150%]"> */}
        <div
          className={twMerge(
            'text-sm',
            'font-black md:text-base',
            'animate-bounce align-super text-white uppercase lg:text-lg',
            'rounded-md bg-black px-2 py-1 shadow-xl shadow-black/30 dark:bg-white dark:text-black',
            'leading-none whitespace-nowrap',
          )}
        >
          STATUS: BETA
          {/* {version === 'latest' ? latestVersion : version} */}
        </div>
        {/* </div> */}
        <h2 className="max-w-md text-2xl font-bold md:text-3xl lg:max-w-2xl lg:text-5xl">
          Full-stack React and Solid framework{' '}
          <span className="underline decoration-yellow-500 decoration-dashed decoration-3 underline-offset-2">
            powered by TanStack Router
          </span>{' '}
        </h2>
        <p className="text max-w-[500px] opacity-90 lg:max-w-[600px] lg:text-xl">
          SSR, Streaming, Server Functions, API Routes, bundling and more
          powered by <strong>TanStack Router</strong> and <strong>Vite</strong>.
          Ready to deploy to your favorite hosting provider.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="./docs/framework/react/quick-start#impatient"
            className={`rounded border-2 border-cyan-500 bg-transparent px-4 py-2 font-extrabold text-cyan-600 uppercase dark:border-cyan-600 dark:text-cyan-400`}
          >
            Try it in 60 seconds
          </Link>
          <Link
            to="./docs/framework/react/overview"
            className={`flex items-center rounded bg-cyan-500 px-4 py-2 font-extrabold text-white uppercase dark:bg-cyan-600`}
          >
            Get Started
          </Link>
        </div>
      </div>
      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />
      <div className="space-y-8 px-4">
        <div className="mr-1 text-center text-3xl font-black">
          When can I use it?
        </div>
        <div className="mx-auto w-[800px] max-w-full space-y-4 rounded-xl bg-white p-8 leading-loose shadow-xl shadow-black/10 dark:bg-black/40">
          <div>
            You can use <strong>TanStack Start BETA</strong> today! Although
            currently in active development, we do not expect any more breaking
            changes. We invite you to provide feedback to help us on the journey
            to 1.0! If you choose to ship a BETA Start app to production, we
            recommend locking your dependencies to a specific version and
            keeping up with the latest releases.
          </div>
        </div>
        <div className="mx-auto grid w-[600px] max-w-full grid-cols-2 items-center justify-center gap-2">
          <Link
            to="/start/latest/docs/framework/react/examples/start-basic"
            className={`flex items-center gap-2 rounded bg-cyan-900 px-4 py-2 font-extrabold text-white uppercase`}
          >
            <VscPreview /> See an Example
          </Link>
          <Link
            to="/start/latest/docs/framework/react/overview"
            className={`flex items-center gap-2 rounded bg-cyan-800 px-4 py-2 font-extrabold text-white uppercase`}
          >
            <FaBook /> Try the BETA
          </Link>
          <a
            href={`https://github.com/tanstack/tanstack.com`}
            className={`flex items-center gap-2 rounded bg-cyan-700 px-4 py-2 font-extrabold text-white uppercase`}
          >
            <FaGithub /> TanStack.com Source
          </a>
          <a
            href={`https://twitter.com/intent/post?text=${encodeURIComponent(
              `TanStack Start is in BETA! It's a new full-stack React framework from @Tan_Stack and you can check it out at https://tanstack.com/start/`,
            )}`}
            target="_blank"
            className={`flex items-center gap-2 rounded bg-cyan-500 px-4 py-2 font-extrabold text-white uppercase`}
            rel="noreferrer"
          >
            <FaTwitter /> Tweet about it!
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

      <div className="mx-auto px-4 md:mx-auto lg:max-w-screen-lg">
        <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
          Partners
        </h3>
        <div className="h-8" />
        <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2`}>
          {partners
            .filter((d) => d.libraries?.includes('router'))
            .map((partner) => {
              return (
                <a
                  key={partner.name}
                  href={partner.href}
                  target="_blank"
                  className="group grid overflow-hidden rounded-lg border-gray-500/20 bg-white shadow-xl shadow-gray-500/20 dark:border dark:bg-black/40 dark:shadow-none"
                  rel="noreferrer"
                >
                  <div className="z-0 col-start-1 row-start-1 flex items-center justify-center transition-all duration-200 group-hover:blur-sm">
                    {partner.homepageImg}
                  </div>
                  <div className="z-10 col-start-1 row-start-1 flex max-w-full flex-col items-start gap-4 bg-white/70 p-4 text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800/70">
                    {partner.content}
                  </div>
                </a>
              )
            })}
        </div>
      </div>

      <div className="relative overflow-hidden text-lg">
        <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
          Sponsors
        </h3>
        <div
          className="mx-auto my-4 flex max-w-screen-lg flex-wrap"
          style={{
            aspectRatio: '1/1',
          }}
        >
          <Await
            promise={sponsorsPromise}
            fallback={<CgSpinner className="animate-spin text-2xl" />}
            children={(sponsors) => {
              return <SponsorPack sponsors={sponsors} />
            }}
          />
        </div>
        <div className="text-center">
          <a
            href="https://github.com/sponsors/tannerlinsley"
            className="mx-auto inline-block rounded-full bg-green-500 px-4 py-2 text-xl leading-tight font-extrabold tracking-tight text-white"
          >
            Become a Sponsor!
          </a>
        </div>
      </div>

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
          <div className="p-8 text-center text-lg w-full max-w-screen-lg mx-auto bg-black text-white rounded-xl">
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

      <div className="flex flex-col items-center gap-4">
        <div className="text-xl font-extrabold lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="font-sm italic opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="/start/latest/docs/framework/react/overview"
            className={`inline-block rounded bg-cyan-500 px-4 py-2 font-extrabold text-white uppercase`}
          >
            Get Started!
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
