import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { virtualProject } from '~/libraries/virtual'
import { seo } from '~/utils/seo'
import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { TbHeartHandshake } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: virtualProject.name,
      description: virtualProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('virtual')

export default function RouteComp() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const [framework, setFramework] = React.useState<Framework>('react')
  const branch = getBranch(virtualProject, version)
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${virtualProject.colorFrom} ${virtualProject.colorTo}`

  return (
    <div className="flex max-w-full flex-col gap-20 pt-32 md:gap-32">
      <div className="flex flex-col items-center gap-8 px-4 text-center">
        <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
          <span>TanStack</span>
          <span className={twMerge(gradientText)}>Virtual</span>
        </h1>
        <h2 className="max-w-md text-2xl font-bold md:text-3xl lg:max-w-2xl lg:text-5xl">
          <span className="underline decoration-yellow-500 decoration-dashed decoration-3 underline-offset-2">
            Headless
          </span>{' '}
          UI for Virtualizing Large Element Lists
        </h2>
        <p className="text max-w-sm opacity-90 lg:max-w-2xl lg:text-xl">
          Virtualize only the visible DOM nodes within massive scrollable
          elements at 60FPS in TS/JS, React, Vue, Solid, Svelte, Lit & Angular
          while retaining 100% control over markup and styles.
        </p>
        <Link
          to="./docs/introduction"
          className={`rounded bg-purple-500 px-4 py-2 font-extrabold text-white uppercase`}
        >
          Get Started
        </Link>
      </div>

      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />

      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pb-16 sm:text-center">
          <h3 className="mx-auto mt-2 text-center text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none">
            Framework Agnostic & Feature Rich
          </h3>
          <p className="mx-auto mt-4 max-w-3xl text-xl leading-7 opacity-60">
            TanStack Virtual's API and engine are highly modular and
            framework-independent while still prioritizing ergonomics. Behold,
            the obligatory feature-list:
          </p>
        </div>
        <div className="mx-auto grid grid-flow-row grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[
            'Lightweight (10 - 15kb)',
            'Tree-Shaking',
            'Headless',
            'Vertical/Column Virtualization',
            'Horizontal/Row Virtualization',
            'Grid Virtualization',
            'Window-Scrolling',
            'Fixed Sizing',
            'Variable Sizing',
            'Dynamic/Measured Sizing',
            'Scrolling Utilities',
            'Sticky Items',
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500" /> {d}
              </span>
            )
          })}
        </div>
      </div>

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
                  'Intuit',
                  'Google',
                  'Amazon',
                  'Apple',
                  'AutoZone',
                  'Microsoft',
                  'Cisco',
                  'Uber',
                  'Salesforce',
                  'Walmart',
                  'Wix',
                  'HP',
                  'Docusign',
                  'Tripwire',
                  'Yahoo!',
                  'Ocado',
                  'Nordstrom',
                  'TicketMaster',
                  'Comcast Business',
                  'Nozzle.io',
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

      <div className="mx-auto w-[500px] max-w-full px-4">
        <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
          Partners
        </h3>
        <div className="h-8" />
        <div className="flex flex-1 flex-col items-center divide-y-2 divide-gray-500/10 overflow-hidden rounded-lg bg-white/80 text-center text-sm shadow-xl shadow-gray-500/20 dark:bg-black/40 dark:shadow-none">
          <span className="flex items-center gap-2 p-12 text-4xl font-black text-rose-500 uppercase">
            Virtual <TbHeartHandshake /> You?
          </span>
          <div className="flex flex-col gap-4 p-4">
            <div>
              We're looking for a TanStack Virtual OSS Partner to go above and
              beyond the call of sponsorship. Are you as invested in TanStack
              Virtual as we are? Let's push the boundaries of Virtual together!
            </div>
            <a
              href="mailto:partners@tanstack.com?subject=TanStack Virtual Partnership"
              className="text-sm font-black text-blue-500 uppercase"
            >
              Let's chat
            </a>
          </div>
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

      <div className="flex flex-col gap-4">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 sm:text-center lg:px-8">
          <h3 className="mt-2 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            With just a few divs and some inline styles, you're already well on
            your way to creating an extremely powerful virtualization
            experience.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {(
              [
                { label: 'React', value: 'react' },
                { label: 'Solid', value: 'solid' },
                { label: 'Lit', value: 'lit' },
                { label: 'Svelte', value: 'svelte' },
                { label: 'Vue', value: 'vue' },
                { label: 'Angular', value: 'angular' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                className={`inline-block rounded px-4 py-2 font-extrabold text-white uppercase ${
                  item.value === framework
                    ? 'bg-purple-500'
                    : 'bg-gray-300 hover:bg-teal-300 dark:bg-gray-700'
                }`}
                onClick={() => setFramework(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {['vue', 'solid', 'svelte'].includes(framework) ? (
        <div className="px-2">
          <div className="mx-auto w-full max-w-screen-lg rounded-xl bg-black p-8 text-center text-lg text-white">
            Looking for the <strong>@tanstack/{framework}-virtual</strong>{' '}
            example? We could use your help to build the{' '}
            <strong>@tanstack/{framework}-virtual</strong> adapter! Join the{' '}
            <a
              href="https://tlinz.com/discord"
              className="font-bold text-teal-500"
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
            src={`https://stackblitz.com/github/${
              virtualProject.repo
            }/tree/${branch}/examples/${framework}/fixed?embed=1&theme=${
              isDark ? 'dark' : 'light'
            }`}
            title="tannerlinsley/react-table: dynamic"
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
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="text-xl font-extrabold lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="font-sm italic opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="./docs/introduction"
            className={`inline-block rounded bg-purple-500 px-4 py-2 font-extrabold text-white uppercase`}
          >
            Get Started!
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
