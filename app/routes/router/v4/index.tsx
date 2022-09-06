import * as React from 'react'

import { CgCornerUpLeft } from 'react-icons/cg'
import {
  FaBolt,
  FaBook,
  FaCheckCircle,
  FaCogs,
  FaDiscord,
  FaGithub,
} from 'react-icons/fa'
import { Link, useLoaderData } from '@remix-run/react'
import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { v4branch } from '../v4'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { IoIosBody } from 'react-icons/io'
import SponsorPack from '~/components/SponsorPack'
import { capitalize } from '~/utils/utils'
import { TbHeartHandshake, TbZoomQuestion } from 'react-icons/tb'
import { VscPreview } from 'react-icons/vsc'
import { RiLightbulbFlashLine } from 'react-icons/ri'
import { CgTimelapse } from 'react-icons/cg'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500'

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
    to: './docs/examples',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaBook className="text-lg" /> Docs
      </div>
    ),
    to: './docs/guide/introduction',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> Github
      </div>
    ),
    to: 'https://github.com/tanstack/router',
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

export const loader: LoaderFunction = async () => {
  const { getSponsorsForSponsorPack } = require('~/server/sponsors')

  const sponsors = await getSponsorsForSponsorPack()

  return json({
    sponsors,
  })
}

export default function ReactTableRoute() {
  const { sponsors } = useLoaderData()
  // const config = useReactTableV8Config()
  // const [params, setParams] = useSearchParams()
  // const framework = params.get('framework') ?? 'react'
  const [framework, setFramework] = React.useState<
    'react' | 'svelte' | 'vue' | 'solid'
  >('react')

  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  return (
    <div className="flex flex-col gap-20 md:gap-32">
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
                <Link to={item.to} prefetch="intent">
                  {label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-6 text-center px-4">
        <h1
          className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl`}
        >
          <span className={gradientText}>TanStack Router</span>{' '}
          <span
            className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
          >
            v4 BETA
          </span>
        </h1>
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          Routing and URL management for your{' '}
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            applications
          </span>
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          Powerful routing with first-class search-param APIs for JS/TS, React,
          Solid, Vue and Svelte
        </p>
        <Link
          to="./docs/guide/introduction"
          className={`py-2 px-4 bg-emerald-500 rounded text-white uppercase font-extrabold`}
          prefetch="intent"
        >
          Get Started
        </Link>
      </div>
      <div
        className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
      >
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <RiLightbulbFlashLine className="text-lime-500 text-6xl scale-125 animate-pulse" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Powerful, yet familiar.
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              While React Router and Next.js have set amazing new expectations
              for application routing, we believe TanStack Router has something
              more to offer. With more powerful APIs around{' '}
              <span className="font-semibold text-lime-600 dark:text-lime-400">
                URL manipulation, navigation, and search params
              </span>
              , routing just get better and better.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <CgTimelapse
              className="text-teal-500 text-6xl animate-spin"
              style={{
                animationDuration: '3s',
                animationTimingFunction: 'ease-in-out',
              }}
            />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Loaders, actions, prefetching, oh my!
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Async routing is expected for full-stack react frameworks but what
              about SPA's?, TanStack Router is async-first and provides
              out-of-the-box support for{' '}
              <span className="font-semibold text-teal-700 dark:text-teal-400">
                parallelized data loaders, code-splitting and even route actions
              </span>
              .
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <TbZoomQuestion className="text-emerald-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              First-Class Search Params API
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Where most other routers provide the bare minimum support for URL
              search param management, TanStack Router takes them very seriously
              with support for{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                search param schemas, param type-safety, and functional
                manipulation.
              </span>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            Framework Agnostic & Feature Rich
          </h3>
          <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
            TanStack Router's core API is very portable and
            framework-independent while still prioritizing the ergonomics of
            frameworks via adapters. Behold, the obligatory feature-list:
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-[max-content] mx-auto">
          {[
            'Lightweight (8kb)',
            'Asynchronous Elements',
            'Route Loaders',
            'Route Actions',
            'Route Params',
            'Code-Splitting',
            'Nested/Layout Routes',
            '1st-Class Search Params API',
            'Search Param Route Matching',
            'Search Param Filters/Persistence',
            'Search Param Compression + Stability',
            'Default Elements',
            'Error Boundary Elements',
            'Pending Elements',
            'Minimum Pending Duration',
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 " /> {d}
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

      <div className="px-4 w-[500px] max-w-full mx-auto">
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
          <span className="flex items-center gap-2 p-12 text-4xl text-rose-500 font-black uppercase">
            Router <TbHeartHandshake /> You?
          </span>
          <div className="flex flex-col p-4 gap-4">
            <div>
              We're looking for a TanStack Router OSS Partner to go above and
              beyond the call of sponsorship. Are you as invested in TanStack
              Router as we are? Let's push the boundaries of Router together!
            </div>
            <a
              href="mailto:partners@tanstack.com?subject=TanStack Router Partnership"
              className="text-blue-500 uppercase font-black text-sm"
            >
              Let's chat
            </a>
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
          <SponsorPack sponsors={sponsors} />
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
          This ad helps us keep the lights on 😉
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            Pop in a Router component and start slinging some routes. Let's see
            it in action!
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
                className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold ${
                  item.value === framework
                    ? 'bg-teal-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-teal-300'
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

      {['vue', 'solid', 'svelte'].includes(framework) ? (
        <div className="px-2">
          <div className="p-8 text-center text-lg w-full max-w-screen-lg mx-auto bg-black text-white rounded-xl">
            Looking for the <strong>@tanstack/{framework}-router</strong>{' '}
            example? We could use your help to build the{' '}
            <strong>@tanstack/{framework}-router</strong> adapter! Join the{' '}
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
            src={`https://codesandbox.io/embed/github/tanstack/router/tree/${v4branch}/examples/${framework}/kitchen-sink?autoresize=1&fontsize=16&theme=${
              isDark ? 'dark' : 'light'
            }`}
            title="tannerlinsley/react-router: kitchen-sink"
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

      <div className="flex flex-col gap-4 items-center">
        <div className="font-extrabold text-xl lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="italic font-sm opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="./docs/guide/introduction"
            className={`inline-block py-2 px-4 bg-emerald-500 rounded text-white uppercase font-extrabold`}
            prefetch="intent"
          >
            Get Started!
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
