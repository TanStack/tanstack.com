import * as React from 'react'

import { CgCornerUpLeft } from 'react-icons/cg'
import {
  FaBolt,
  FaBook,
  FaCheckCircle,
  FaCogs,
  FaDiscord,
  FaGithub,
  FaTshirt,
} from 'react-icons/fa'
import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useLoaderData, useParams } from '@remix-run/react'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { VscPreview, VscWand } from 'react-icons/vsc'
import { TbHeartHandshake } from 'react-icons/tb'
import SponsorPack from '~/components/SponsorPack'
import { PPPBanner } from '~/components/PPPBanner'
import { getBranch, latestVersion, repo } from '~/routes/query'
import { Logo } from '~/components/Logo'
import { LogoQueryGG } from '~/components/LogoQueryGG'

export type Framework = 'react' | 'svelte' | 'vue' | 'solid'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500'

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
    to: './docs/react/examples/react/basic',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaBook className="text-lg" /> Docs
      </div>
    ),
    to: './docs/',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> GitHub
      </div>
    ),
    to: `https://github.com/${repo}`,
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

export const loader = async (context: LoaderArgs) => {
  const { getSponsorsForSponsorPack } = require('~/server/sponsors')

  const sponsors = await getSponsorsForSponsorPack()

  return json({
    sponsors,
  })
}

export default function RouteVersion() {
  const { sponsors } = useLoaderData<typeof loader>()
  const { version } = useParams()
  const branch = getBranch(version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  return (
    <>
      <PPPBanner />
      <div className="flex flex-col gap-20 md:gap-32">
        <div
          className="flex flex-wrap py-2 px-4 items-center justify-center text-sm max-w-screen-xl mx-auto
          md:text-base md:self-end"
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
                  <Link to={item.to} prefetch="intent">
                    {label}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-col items-center gap-8 text-center px-4">
          <div className="flex gap-2 lg:gap-4 items-center">
            <Logo className="w-[40px] md:w-[60px] lg:w-[100px]" />
            <h1
              className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl`}
            >
              <span className={gradientText}>TanStack Query</span>{' '}
              <span
                className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
              >
                {version === 'latest' ? latestVersion : version}
              </span>
            </h1>
          </div>
          <h2
            className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
          >
            Powerful{' '}
            <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
              asynchronous state management
            </span>{' '}
            for TS/JS, React, Solid, Vue and Svelte
          </h2>
          <p
            className="text opacity-90 max-w-[500px]
            lg:text-xl lg:max-w-[600px]"
          >
            Toss out that granular state management, manual refetching and
            endless bowls of async-spaghetti code. TanStack Query gives you
            declarative, always-up-to-date auto-managed queries and mutations
            that{' '}
            <strong>
              directly improve both your developer and user experiences
            </strong>
            .
          </p>
          <Link
            to="./docs/"
            className={`py-2 px-4 bg-red-500 rounded text-white uppercase font-extrabold`}
            prefetch="intent"
          >
            Get Started
          </Link>
          <p>
            Want to skip the docs?{' '}
            <a
              href="https://ui.dev/react-query?from=tanstack"
              className={`${gradientText} underline`}
            >
              Check out the official React Query course
            </a>
          </p>
        </div>
        <div
          className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
        >
          <div className="flex-1 flex flex-col gap-8 items-center">
            <VscWand className="text-red-500 text-6xl" />
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Declarative & Automatic
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                Writing your data fetching logic by hand is over. Tell TanStack
                Query where to get your data and how fresh you need it to be and
                the rest is automatic. It handles{' '}
                <span className="font-semibold text-red-700 dark:text-red-400">
                  caching, background updates and stale data out of the box with
                  zero-configuration
                </span>
                .
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-8 items-center">
            <div className="text-center">
              <FaBolt className="text-orange-600 text-6xl" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Simple & Familiar
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                If you know how to work with promises or async/await, then you
                already know how to use TanStack Query. There's{' '}
                <span className="font-semibold text-orange-700 dark:text-orange-400">
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
              <FaCogs className="text-amber-500 text-6xl" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Extensible
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                TanStack Query is configurable down to each observer instance of
                a query with knobs and options to fit every use-case. It comes
                wired up with{' '}
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  dedicated devtools, infinite-loading APIs, and first class
                  mutation tools that make updating your data a breeze
                </span>
                . Don't worry though, everything is pre-configured for success!
              </p>
            </div>
          </div>
        </div>

        <div className="px-4">
          <div className="bg-white w-[600px] max-w-full mx-auto dark:bg-gray-800 shadow-lg rounded-xl overflow-hidden">
            <LogoQueryGG className="w-full" />
            <div className="flex flex-col items-center gap-8 p-4 sm:p-8 pt-2">
              <div className="text-center">
                <div className="text opacity-70 mt-2">
                  Created by <strong>Dominik Dorfmeister</strong> and{' '}
                  <a className="font-bold underline" href="https://ui.dev/">
                    ui.dev
                  </a>
                </div>
              </div>

              <div className="text-xl w-[34ch] max-w-full leading-7 text-center">
                “This is the best way to learn how to use React Query in real-world applications.”
                <div className="mt-2 text-base italic">- Tanner Linsley</div>
              </div>

              <div className="grid max-w-screen-lg mx-auto text-lg gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-2xl text-green-500 mt-0.5">
                    <FaCheckCircle />
                  </span>
                  Save time by learning with a guided approach
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-2xl text-green-500 mt-0.5">
                    <FaCheckCircle />
                  </span>
                  Get hands-on experience building a real world application
                </div>
                <div className="flex items-start gap-2 mt-0.5">
                  <span className="text-2xl text-green-500">
                    <FaCheckCircle />
                  </span>
                  Never worry about data fetching again
                </div>
              </div>
              <a
                href="https://query.gg?from=tanstack"
                target="_blank"
                className={`inline-block py-2 px-4 bg-red-500 rounded text-white uppercase font-extrabold`}
                rel="noreferrer"
              >
                Check it out
              </a>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              No dependencies. All the Features.
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              With zero dependencies, TanStack Query is extremely lean given the
              dense feature set it provides. From weekend hobbies all the way to
              enterprise e-commerce systems (Yes, I'm lookin' at you Walmart!
              😉), TanStack Query is the battle-hardened tool to help you
              succeed at the speed of your creativity.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-[max-content] mx-auto">
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
            {/* @ts-ignore */}
          </marquee>
        </div>

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
              Query <TbHeartHandshake /> You?
            </span>
            <div className="flex flex-col p-4 gap-4">
              <div>
                We're looking for a TanStack Query OSS Partner to go above and
                beyond the call of sponsorship. Are you as invested in TanStack
                Query as we are? Let's push the boundaries of Query together!
              </div>
              <a
                href="mailto:partners@tanstack.com?subject=TanStack Query Partnership"
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
              Less code, fewer edge cases.
            </h3>
            <p className="my-4 text-xl leading-7  text-gray-600">
              Instead of writing reducers, caching logic, timers, retry logic,
              complex async/await scripting (I could keep going...), you
              literally write a tiny fraction of the code you normally would.
              You will be surprised at how little code you're writing or how
              much code you're deleting when you use TanStack Query. Try it out
              with one of the examples below!
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
                      ? 'bg-red-500'
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-red-300'
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

        {[''].includes(framework) ? (
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
              src={`https://codesandbox.io/embed/github/${repo}/tree/${branch}/examples/${framework}/basic?autoresize=1&fontsize=16&theme=${
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
              to="./docs/"
              className={`inline-block py-2 px-4 bg-red-500 rounded text-white uppercase font-extrabold`}
              prefetch="intent"
            >
              Get Started!
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
