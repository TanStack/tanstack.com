import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { tableProject } from '~/libraries/table'
import { partners } from '~/utils/partners'
import { getExampleStartingPath } from '~/utils/sandbox'
import { seo } from '~/utils/seo'
import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  component: TableVersionIndex,
  head: () => ({
    meta: seo({
      title: tableProject.name,
      description: tableProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('table')

export default function TableVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(tableProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark, setIsDark] = React.useState(true)

  const sandboxFirstFileName = getExampleStartingPath(framework)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${tableProject.colorFrom} ${tableProject.colorTo}`

  return (
    <div className="flex max-w-full flex-col gap-20 pt-32 md:gap-32">
      <div className="flex flex-col items-center gap-8 px-4 text-center">
        <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
          <span>TanStack</span>
          <span className={twMerge(gradientText)}>Table</span>
        </h1>
        <h2 className="max-w-md text-2xl font-bold md:text-3xl lg:max-w-2xl lg:text-5xl">
          <span className="underline decoration-yellow-500 decoration-dashed decoration-3 underline-offset-2">
            Headless
          </span>{' '}
          UI for building powerful tables & datagrids
        </h2>
        <p className="text max-w-sm opacity-90 lg:max-w-2xl lg:text-xl">
          Supercharge your tables or build a datagrid from scratch for TS/JS,
          React, Vue, Solid, Svelte & Lit while retaining 100% control over
          markup and styles.
        </p>
        <Link
          to="./docs/introduction/"
          className={`rounded bg-blue-500 px-4 py-2 font-extrabold text-white uppercase`}
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
            TanStack Table's API and engine are highly modular and
            framework-independent while still prioritizing ergonomics. Behold,
            the obligatory feature-list:
          </p>
        </div>
        <div className="mx-auto grid grid-flow-row grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[
            'Lightweight (10 - 15kb)',
            'Tree-Shaking',
            'Headless',
            'Cell Formatters',
            'Auto-managed internal state',
            'Opt-in fully controlled state',
            'Sorting',
            'Multi Sort',
            'Global Filters',
            'Columns Filters',
            'Pagination',
            'Row Grouping',
            'Aggregation',
            'Row Selection',
            'Row Expansion',
            'Column Ordering',
            'Column Visibility',
            'Column Resizing',
            'Virtualizable',
            'Server-side/external Data',
            'Nested/Grouped Headers',
            'Footers',
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500" /> {d}
              </span>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 text-center text-sm font-semibold tracking-wider text-gray-400 uppercase">
          Trusted in Production by
        </div>
        {/* @ts-ignore */}
        <marquee scrollamount="2">
          <div className="ml-[-100%] flex items-center gap-2 text-3xl font-bold">
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
                ],
              )
              .map((d, i) => (
                <span key={i} className="opacity-70 even:opacity-40">
                  {d}
                </span>
              ))}
          </div>
          {/* @ts-ignore */}
        </marquee>
      </div>

      <div className="mx-auto px-4 md:mx-auto lg:max-w-screen-lg">
        <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
          Partners
        </h3>
        <div className="h-8" />
        <div className={`grid max-w-[400px] grid-cols-1 gap-6`}>
          {partners
            .filter((d) => d.libraries?.includes('table'))
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

      <div className="flex flex-col gap-4">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 sm:text-center lg:px-8">
          <h3 className="mt-2 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            With some basic styles, some table markup and few columns, you're
            already well on your way to creating a drop-dead powerful table.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {(
              [
                { label: 'Angular', value: 'angular' },
                { label: 'Lit', value: 'lit' },
                { label: 'Qwik', value: 'qwik' },
                { label: 'React', value: 'react' },
                { label: 'Solid', value: 'solid' },
                { label: 'Svelte', value: 'svelte' },
                { label: 'Vue', value: 'vue' },
                { label: 'Vanilla', value: 'vanilla' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                className={`inline-block rounded px-4 py-2 font-extrabold text-white uppercase ${
                  item.value === framework
                    ? 'bg-rose-500'
                    : 'bg-gray-300 hover:bg-rose-300 dark:bg-gray-700'
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
        <iframe
          key={framework}
          src={`https://stackblitz.com/github/${
            tableProject.repo
          }/tree/${branch}/examples/${framework}/basic?embed=1&theme=${
            isDark ? 'dark' : 'light'
          }&preset=node&file=${sandboxFirstFileName}`}
          title="tannerlinsley/react-table: basic"
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

      <div className="flex flex-col items-center gap-4">
        <div className="text-xl font-extrabold lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="font-sm italic opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="/$libraryId/$version/docs/$"
            params={{
              libraryId: 'table',
              version,
              _splat: 'introduction',
            }}
            className={`inline-block rounded bg-teal-500 px-4 py-2 font-extrabold text-white uppercase`}
          >
            Get Started!
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
