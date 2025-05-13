import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { Await, Link, getRouteApi } from '@tanstack/react-router'
import { routerProject } from '~/libraries/router'
import { Footer } from '~/components/Footer'
import SponsorPack from '~/components/SponsorPack'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { partners } from '~/utils/partners'
import { twMerge } from 'tailwind-merge'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'

export const Route = createFileRoute({
  component: RouterVersionIndex,
  head: () => ({
    meta: seo({
      title: routerProject.name,
      description: routerProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('router')

function RouterVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(routerProject, version)
  const [framework] = React.useState<Framework>('react')
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${routerProject.colorFrom} ${routerProject.colorTo}`

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <div className="flex flex-col items-center gap-8 text-center px-4">
        <h1 className="font-black flex gap-3 items-center text-4xl md:text-6xl lg:text-7xl xl:text-8xl uppercase [letter-spacing:-.05em]">
          <span>TanStack</span>
          <span className={twMerge(gradientText)}>Router</span>
        </h1>
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            Modern and scalable
          </span>{' '}
          routing for React and Solid applications
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          A fully type-safe router with built-in data fetching, stale-while
          revalidate caching and first-class search-param APIs.
        </p>
        <Link
          to="./docs/framework/react/overview"
          className={`py-2 px-4 bg-emerald-500 rounded text-white uppercase font-extrabold`}
        >
          Get Started
        </Link>
      </div>
      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />
      <div className="px-4 lg:max-w-screen-lg md:mx-auto mx-auto">
        <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
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
                  className="shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 bg-white dark:bg-black/40 dark:shadow-none group overflow-hidden grid"
                  rel="noreferrer"
                >
                  <div className="z-0 row-start-1 col-start-1 flex items-center justify-center group-hover:blur-sm transition-all duration-200">
                    {partner.homepageImg}
                  </div>
                  <div className="z-10 row-start-1 col-start-1 max-w-full p-4 text-sm flex flex-col gap-4 items-start opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/70 dark:bg-gray-800/70">
                    {partner.content}
                  </div>
                </a>
              )
            })}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 mx-auto">
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            Feature Rich and Lightweight
          </h3>
          <p className="mt-4 text-xl w-3xl mx-auto leading-7 opacity-60">
            Behold, the obligatory feature-list:
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4  mx-auto">
          {[
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
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 " /> {d}
              </span>
            )
          })}
        </div>
      </div>

      <div className="relative text-lg overflow-hidden">
        <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
          Sponsors
        </h3>
        <div
          className="my-4 flex flex-wrap mx-auto max-w-screen-lg w-full"
          style={{
            aspectRatio: '1/1',
          }}
        >
          <Await
            promise={sponsorsPromise}
            fallback={<CgSpinner className="text-2xl animate-spin" />}
            children={(sponsors) => {
              return <SponsorPack sponsors={sponsors} />
            }}
          />
        </div>
        <div className="text-center">
          <a
            href="https://github.com/sponsors/tannerlinsley"
            className="inline-block bg-green-500 px-4 py-2 text-xl mx-auto leading-tight font-extrabold tracking-tight text-white rounded-full"
          >
            Become a Sponsor!
          </a>
        </div>
      </div>

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

        {/* {['preact', 'vue', 'solid', 'svelte'].includes(framework) ? (
        <div className="px-2">
          <div className="p-8 text-center text-lg w-full max-w-screen-lg mx-auto bg-black text-white rounded-xl">
            Looking for the <strong>@tanstack/{framework}-router</strong>{' '}
            example? The <strong>@tanstack/{framework}-router</strong> adapter
            is currently under development! Join the{' '}
            <a
              href="https://tlinz.com/discord"
              className="text-teal-500 font-bold"
            >
              TanStack Discord Server
            </a>{' '}
            and help us make routing in {framework} a better place!
          </div>
        </div>
      ) : ( */}
        <div className="bg-white dark:bg-black">
          <iframe
            key={framework}
            src={`https://stackblitz.com/github/${
              routerProject.repo
            }/tree/${branch}/examples/${framework}/kitchen-sink-file-based?file=src%2Fmain.tsx&embed=1&theme=${
              isDark ? 'dark' : 'light'
            }`}
            title="tannerlinsley/router: kitchen-sink"
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
      </div>

      <div className="flex flex-col gap-4 items-center">
        <div className="font-extrabold text-xl lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="italic font-sm opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="./docs/framework/react/overview"
            className={`inline-block py-2 px-4 bg-emerald-500 rounded text-white uppercase font-extrabold`}
          >
            Get Started!
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
