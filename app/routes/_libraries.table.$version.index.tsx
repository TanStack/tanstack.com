import * as React from 'react'
import { CgCornerUpLeft, CgSpinner } from 'react-icons/cg'
import {
  FaBolt,
  FaBook,
  FaCheckCircle,
  FaCogs,
  FaDiscord,
  FaGithub,
  FaTshirt,
} from 'react-icons/fa'
import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { tableProject } from '~/libraries/table'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { IoIosBody } from 'react-icons/io'
import SponsorPack from '~/components/SponsorPack'
import { VscPreview } from 'react-icons/vsc'
import agGridImage from '~/images/ag-grid.png'
import { Await } from '@tanstack/react-router'
import { Framework, getBranch } from '~/libraries'
import { seo } from '~/utils/seo'
import { getInitialSandboxFileName } from '~/utils/sandbox'

const menu = [
  {
    label: (
      <div className="flex items-center gap-2">
        <CgCornerUpLeft className="text-lg" /> TanStack
      </div>
    ),
    to: '/',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <VscPreview className="text-lg" /> Examples
      </div>
    ),
    to: './docs/framework/react/examples/basic',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaBook className="text-lg" /> Docs
      </div>
    ),
    to: './docs/introduction',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> GitHub
      </div>
    ),
    to: `https://github.com/${tableProject.repo}`,
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaDiscord className="text-lg" /> Discord
      </div>
    ),
    to: 'https://tlinz.com/discord',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaTshirt className="text-lg" /> Merch
      </div>
    ),
    to: `https://cottonbureau.com/people/tanstack`,
  },
]

export const Route = createFileRoute('/_libraries/table/$version/')({
  component: TableVersionIndex,
  meta: () =>
    seo({
      title: tableProject.name,
      description: tableProject.description,
    }),
})

const librariesRouteApi = getRouteApi('/_libraries')

export default function TableVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(tableProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark, setIsDark] = React.useState(true)

  const sandboxFirstFileName = getInitialSandboxFileName(framework)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const gradientText = `inline-block text-transparent bg-clip-text bg-gradient-to-r ${tableProject.colorFrom} ${tableProject.colorTo}`

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full">
      <div
        className="flex flex-wrap py-2 px-4 items-center justify-center text-sm max-w-screen-xl mx-auto
          md:text-base md:self-end"
      >
        {menu?.map((item, i) => {
          const label = (
            <div className="p-2 opacity-90 hover:opacity-100">{item.label}</div>
          )

          return (
            <div key={i} className="hover:underline">
              {item.to.startsWith('http') ? (
                <a href={item.to}>{label}</a>
              ) : (
                <Link to={item.to} params>
                  {label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-8 text-center px-4">
        <div className="flex gap-2 lg:gap-4 items-center">
          <h1
            className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl`}
            style={{
              viewTransitionName: `library-name`,
            }}
          >
            <span className={`${gradientText}`}>TanStack Table</span>{' '}
            <span
              className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
            >
              v8
            </span>
          </h1>
        </div>
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            Headless
          </span>{' '}
          UI for building powerful tables & datagrids
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          Supercharge your tables or build a datagrid from scratch for TS/JS,
          React, Vue, Solid, Svelte & Lit while retaining 100% control over
          markup and styles.
        </p>
        <Link
          to="./docs/introduction"
          className={`py-2 px-4 bg-teal-500 rounded text-white uppercase font-extrabold`}
        >
          Get Started
        </Link>
      </div>
      <div
        className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
      >
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center overflow-hidden">
            <IoIosBody className="text-teal-500 text-6xl -mt-5 mb-5 scale-125 origin-top" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Designed for zero design
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              What good is a powerful table if that super hip designer you just
              hired can't work their UI magic on it?{' '}
              <span className="font-semibold text-teal-700 dark:text-teal-400">
                TanStack Table is headless by design
              </span>
              , which means 100% control down to the very smallest HTML tag,
              component, class and style. Pixel Perfection? Go for it!
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaBolt className="text-blue-600 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Big Power, Small Package
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Don't be fooled by the small bundle size. TanStack Table is a
              workhorse. It's built to materialize, filter, sort, group,
              aggregate, paginate and display massive data sets using a very
              small API surface. Wire up your new or existing tables and{' '}
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                watch your users become instantly more productive
              </span>
              .
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaCogs className="text-indigo-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Extensible
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              TanStack table ships with excellent defaults to get you off the
              ground as fast as possible, but nothing is stopping you from{' '}
              <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                customizing and overriding literally everything to your liking
              </span>
              . Feeling tenacious enough to build your own Sheets/Excel/AirTable
              clone? Be our guest 😉
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 mx-auto">
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            Framework Agnostic & Feature Rich
          </h3>
          <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
            TanStack Table's API and engine are highly modular and
            framework-independent while still prioritizing ergonomics. Behold,
            the obligatory feature-list:
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4  mx-auto">
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
                <FaCheckCircle className="text-green-500 " /> {d}
              </span>
            )
          })}
        </div>
      </div>

      <div>
        <div className="uppercase tracking-wider text-sm font-semibold text-center text-gray-400 mb-3">
          Trusted in Production by
        </div>
        {/* @ts-ignore */}
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
          {/* @ts-ignore */}
        </marquee>
      </div>

      <div className="px-4 w-[450px] max-w-full mx-auto">
        <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
          Partners
        </h3>
        <div className="h-8" />
        <div
          className="flex-1 flex flex-col items-center text-sm text-center
                      bg-white shadow-xl shadow-gray-500/20 rounded-lg
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
        >
          <a
            href="https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable"
            target="_blank"
            className="p-2 bg-white w-full"
            rel="noreferrer"
          >
            <img
              alt="AG Grid"
              src={agGridImage}
              className="w-full mx-auto max-w-[300px]"
              width="300"
              height="104"
            />
          </a>
          <div className="flex flex-col p-4 gap-4">
            <div>
              TanStack Table and AG Grid are respectfully the{' '}
              <strong>best table/datagrid libraries around</strong>. Instead of
              competing, we're working together to ensure the highest quality
              table/datagrid options are available for the entire JS/TS
              ecosystem and every use-case.
            </div>
            <Link
              to="/blog/$"
              params={{
                _splat: 'ag-grid-partnership',
              }}
              className="text-blue-500 uppercase font-black text-sm"
            >
              Read More
            </Link>
          </div>
        </div>
      </div>

      <div className="relative text-lg overflow-hidden">
        <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
          Sponsors
        </h3>
        <div
          className="my-4 flex flex-wrap mx-auto max-w-screen-lg"
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

      <div className="mx-auto max-w-[400px] flex flex-col gap-2 items-center">
        <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white">
          <Carbon />
        </div>
        <span
          className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500
                dark:bg-opacity-20"
        >
          This ad helps us be happy about our invested time and not burn out and
          rage-quit OSS. Yay money! 😉
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            With some basic styles, some table markup and few columns, you're
            already well on your way to creating a drop-dead powerful table.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
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
                className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                  item.value === framework
                    ? 'bg-rose-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-rose-300'
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

      <div className="flex flex-col gap-4 items-center">
        <div className="font-extrabold text-xl lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="italic font-sm opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="./docs/introduction"
            className={`inline-block py-2 px-4 bg-teal-500 rounded text-white uppercase font-extrabold`}
          >
            Get Started!
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
