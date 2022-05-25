import * as React from 'react'
import { ParentSize } from '@visx/responsive'
import { CgCornerUpLeft } from 'react-icons/cg'
import { FaBook, FaCheckCircle, FaDiscord, FaGithub } from 'react-icons/fa'
import { Link } from 'remix'
import { v8branch } from '../v8'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-600'

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
        <FaBook className="text-lg" /> Docs
      </div>
    ),
    to: './docs/guide/00-introduction',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> Github
      </div>
    ),
    to: 'https://github.com/tanstack/react-table',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaDiscord className="text-lg" /> Discord
      </div>
    ),
    to: 'https://tlinz.com/discord',
  },
]

export default function ReactTableRoute() {
  // const config = useReactTableV8Config()
  // const [params, setParams] = useSearchParams()
  // const framework = params.get('framework') ?? 'react'
  const [framework, setFramework] = React.useState<
    'react' | 'svelte' | 'vue' | 'solid'
  >('react')

  return (
    <>
      <div>
        <div
          className="flex flex-wrap py-2 px-4 items-center justify-center text-sm
          md:text-base md:justify-end"
        >
          {menu?.map((item, i) => {
            const label = (
              <div className="p-2 opacity-90 hover:opacity-100">
                {item.label}
              </div>
            )

            return (
              <div key={i} className="hover:underline">
                {item.to.startsWith('http') ? (
                  <a href={item.to}>{label}</a>
                ) : (
                  <Link to={item.to}>{label}</Link>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-col items-center gap-6 text-center px-4 py-12 lg:py-24">
          <h1
            className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl`}
          >
            <span className={gradientText}>TanStack Table</span>{' '}
            <span
              className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
            >
              v8
            </span>
          </h1>
          <h2
            className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
          >
            <span className="underline decoration-dashed decoration-rose-500 decoration-3 underline-offset-2">
              Headless
            </span>{' '}
            UI for building powerful tables & datagrids
          </h2>
          <p
            className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
          >
            Supercharge your tables or build a datagrid from scratch for TS/JS,
            React, Vue, Solid & Svelte while retaining 100% control over markup
            and styles.
          </p>
          <Link
            to="./docs/guide/00-introduction"
            className={`py-2 px-4 bg-rose-500 rounded text-white uppercase font-extrabold`}
          >
            Get Started
          </Link>
        </div>
        <div
          className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
        >
          <div className="flex flex-col gap-2">
            <h3 className="text-xl xl:text-2xl font-bold">
              Designed to have zero design.
            </h3>
            <p className="text-sm opacity-70 leading-6">
              You want your tables to be powerful without sacrificing how they
              look! After all, what good is that nice theme you designed if you
              can't use it?! TanStack Table is <strong>headless</strong> by
              design (it's just a hook), which means that you are in complete
              and full control of how your table renders down to the very last
              component, class or style.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xl xl:text-2xl font-bold">
              Powerful and Declarative
            </h3>
            <p className="text-sm opacity-70 leading-6">
              TanStack Table is a workhorse. It's built to materialize, filter,
              sort, group, aggregate, paginate and display massive data sets
              using a very small API surface. Just hitch your wagon (new or
              existing tables) to TanStack Table and you'll be supercharged into
              productivity like never before.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xl xl:text-2xl font-bold">Extensible</h3>
            <p className="text-sm opacity-70 leading-6">
              Plugins are important for a healthy ecosystem, which is why React
              Table has its very own plugin system allowing you to override or
              extend any logical step, stage or process happening under the
              hood. Are you itching to build your own row grouping and
              aggregation strategy? It's all possible!
            </p>
          </div>
        </div>
        <div>
          <div className="pt-20 pb-4">
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
        </div>
        <div className="relative text-lg overflow-hidden py-12">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
            Sponsors
          </h3>
          <div className="py-4 flex flex-wrap mx-auto max-w-screen-lg">
            <ParentSize>
              {({ width }) => {
                return (
                  <iframe
                    title="sponsors"
                    src={
                      process.env.NODE_ENV === 'development'
                        ? 'http://localhost:3001/sponsors-embed'
                        : 'https://tanstack.com/sponsors-embed'
                    }
                    style={{
                      width: width,
                      height: width,
                      overflow: 'hidden',
                    }}
                  />
                )
              }}
            </ParentSize>
          </div>
          <div className="text-center mb-8">
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className="inline-block bg-green-500 px-4 py-2 text-xl mx-auto leading-tight font-extrabold tracking-tight text-white rounded-full"
            >
              Become a Sponsor!
            </a>
          </div>
        </div>

        <div className="py-24 flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
            <h3 className="text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
              Take it for a spin!
            </h3>
            <p className="my-4 text-xl leading-7  text-gray-600">
              With some basic styles, some table markup and few columns, you're
              already well on your way to creating a drop-dead powerful table.
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
                  className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                    item.value === framework
                      ? 'bg-rose-500'
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-rose-300'
                  }`}
                  onClick={
                    () => setFramework(item.value)
                    // setParams(new URLSearchParams({ framework: item.value }), {
                    //   replace: true,
                    //   state: {
                    //     scroll: false,
                    //   },
                    // })
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-black body-font">
          <iframe
            key={framework}
            src={`https://codesandbox.io/embed/github/tanstack/react-table/tree/${v8branch}/examples/${framework}/basic?autoresize=1&fontsize=16&theme=dark`}
            title="tannerlinsley/react-table: basic"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            className="shadow-2xl"
            style={{
              width: '100%',
              height: '80vh',
              border: '0',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'static',
              zIndex: 0,
            }}
          ></iframe>
        </div>
        <div className="py-24 px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Framework Agnostic & Feature Rich
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              TanStack Table's API and engine are highly modular and
              framework-independent while still prioritizing ergonomics. Behold,
              the obligatory and expected feature-list:
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-4 w-[max-content] mx-auto text-lg">
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
        {/*<div className="bg-gray-200 border-b border-gray-300">
          <div className="container mx-auto py-12 text-center">
            <h3 className="text-2xl md:text-5xl mx-auto leading-tight font-extrabold tracking-tight text-gray-800  lg:leading-none mt-2">
              Feeling Chatty?
            </h3>
            <a
              href="https://discord.gg/WrRKjPJ"
              target="_blank"
              className="inline-block bg-gray-800 p-5 text-2xl mx-auto leading-tight font-extrabold tracking-tight text-white mt-12 rounded-full"
            >
              Join the #TanStack Discord!
            </a>
          </div>
        </div>
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="container mx-auto py-24 px-4 flex flex-wrap md:flex-no-wrap items-center justify-between md:space-x-8">
            <h2 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10">
              Wow, you've come a long way!
            </h2>
            <div className="mt-8 flex lg:flex-shrink-0 md:mt-0">
              <div className="inline-flex rounded-md shadow">
                <Link href="/docs/overview">
                  <a className="inline-flex items-center justify-center text-center px-5 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-coral hover:bg-coral-light focus:outline-none focus:shadow-outline transition duration-150 ease-in-out">
                    Okay, let's get started!
                  </a>
                </Link>
              </div>
              <div className="ml-3 inline-flex rounded-md shadow">
                <a
                  href={siteConfig.repoUrl}
                  className="inline-flex items-center justify-center text-center px-5 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-coral bg-white hover:text-coral-light focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                >
                  Take me to the GitHub repo.
                </a>
              </div>
            </div>
          </div>
        </div>
        <Footer />
        <style jsx global>{`
          .gradient {
            -webkit-mask-image: linear-gradient(
              180deg,
              transparent 0,
              #000 30px,
              #000 calc(100% - 200px),
              transparent calc(100% - 100px)
            );
          }
        `}</style> */}
      </div>
    </>
  )
}
