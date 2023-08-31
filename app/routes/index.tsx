import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useTransition,
} from '@remix-run/react'
import type { ActionFunction } from '@remix-run/node'
import { json, LoaderArgs } from '@remix-run/node'
import { Carbon } from '~/components/Carbon'
import { ParentSize } from '@visx/responsive'
import { twMerge } from 'tailwind-merge'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { CgMusicSpeaker } from 'react-icons/cg'
import { Footer } from '~/components/Footer'
import SponsorPack from '~/components/SponsorPack'
import { fetchCached } from '~/utils/cache.server'
import { LinkOrA } from '~/components/LinkOrA'

const gradients = [
  `from-rose-500 to-yellow-500`,
  `from-yellow-500 to-teal-500`,
  `from-teal-500 to-violet-500`,
  `from-blue-500 to-pink-500`,
]

const menu = [
  {
    label: (
      <div className="flex items-center gap-1">
        <CgMusicSpeaker className="text-lg" /> Blog
      </div>
    ),
    to: '/blog',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> GitHub
      </div>
    ),
    to: 'https://github.com/tanstack',
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

const libraries = [
  {
    name: 'TanStack Query',
    getStyles: () =>
      `shadow-xl shadow-red-700/20 dark:shadow-lg dark:shadow-red-500/30 text-red-500 border-2 border-transparent hover:border-current`,
    to: '/query',
    tagline: `Powerful asynchronous state management, server-state utilities and data fetching`,
    description: `Fetch, cache, update, and wrangle all forms of async data in your TS/JS, React, Vue, Solid & Svelte applications all without touching any "global state".`,
  },
  {
    name: 'TanStack Table',
    getStyles: () =>
      `shadow-xl shadow-blue-700/20 dark:shadow-lg dark:shadow-blue-500/30 text-blue-500 border-2 border-transparent hover:border-current`,
    to: '/table',
    tagline: `Headless UI for building powerful tables & datagrids`,
    description: `Supercharge your tables or build a datagrid from scratch for TS/JS, React, Vue, Solid & Svelte while retaining 100% control over markup and styles.`,
  },
  {
    name: 'TanStack Router',
    getStyles: () =>
      `shadow-xl shadow-emerald-700/20 dark:shadow-lg dark:shadow-emerald-500/30 text-emerald-500 dark:text-emerald-400 border-2 border-transparent hover:border-current`,
    to: '/router',
    tagline: `Type-safe Routing for React applications.`,
    description: `Powerful routing for your React applications including a fully type-safe API and first-class search-param for managing state in the URL.`,
    badge: (
      <div className="uppercase text-white bg-emerald-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        Beta
      </div>
    ),
  },
  // {
  //   name: 'TanStack Start',
  //   getStyles: () =>
  //     `
  //     text-transparent bg-clip-text bg-[linear-gradient(to_right,#59b8ff,#e331d8,#ff9600,red)]
  //     shadow-xl shadow-amber-700/20 dark:shadow-lg dark:shadow-amber-500/30 border-2 border-transparent hover:border-current
  //     `,
  //   // to: 'https://github.com/tannerlinsley/react-ranger',
  //   tagline: `Type-safe, SSR-friendly meta-framework for React & Preact.`,
  //   description: `A meta-framework for building modern React & Preact applications, powered by TanStack Router, Astro & Bling.`,
  //   badge: (
  //     <div className="flex items-center justify-center whitespace-nowrap uppercase text-white rounded-full px-2 py-1 text-xs font-black animate-pulse bg-[linear-gradient(to_right,#59b8ff,#e331d8,#ff9600)]">
  //       Alpha
  //     </div>
  //   ),
  // },
  {
    name: 'TanStack Virtual',
    getStyles: () =>
      `shadow-xl shadow-purple-700/20 dark:shadow-lg dark:shadow-purple-500/30 text-purple-500 border-2 border-transparent hover:border-current`,
    to: '/virtual',
    tagline: `Headless UI for Virtualizing Large Element Lists`,
    description: `Virtualize only the visible content for massive scrollable DOM nodes at 60FPS in TS/JS, React, Vue, Solid & Svelte while retaining 100% control over markup and styles.`,
    // badge: (
    //   <div className="uppercase text-white bg-purple-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
    //     New
    //   </div>
    // ),
  },
  {
    name: 'TanStack Form',
    getStyles: () =>
      `shadow-xl shadow-yellow-700/20 dark:shadow-lg dark:shadow-yellow-500/30 text-yellow-500 border-2 border-transparent hover:border-current`,
    to: '/form',
    tagline: `Headless UI for building performant and type-safe forms`,
    description: `Headless, performant, and type-safe form state management for TS/JS, React, Solid, Svelte and Vue`,
    badge: (
      <div className="uppercase text-white bg-yellow-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        New
      </div>
    ),
  },
  {
    name: 'React Charts',
    getStyles: () =>
      `shadow-xl shadow-orange-700/20 dark:shadow-lg dark:shadow-orange-500/30 text-orange-500 border-2 border-transparent hover:border-current`,
    to: 'https://react-charts.tanstack.com',
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
  },
  {
    name: 'React Ranger',
    getStyles: () =>
      `shadow-xl shadow-pink-700/20 dark:shadow-lg dark:shadow-pink-500/30 text-pink-500 border-2 border-transparent hover:border-current`,
    to: 'https://github.com/tannerlinsley/react-ranger',
    tagline: `Headless range and multi-range slider utilities.`,
    description: `React ranger supplies the primitive range and multi-range slider logic as a headless API that can be attached to any styles or markup for that perfect design.`,
    badge: (
      <div className="uppercase text-white bg-pink-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        Beta
      </div>
    ),
  },
  {
    name: 'TanStack Loaders',
    getStyles: () =>
      `shadow-xl shadow-amber-700/20 dark:shadow-lg dark:shadow-amber-500/30 text-amber-500 border-2 border-transparent hover:border-current`,
    // to: 'https://github.com/tannerlinsley/react-ranger',
    tagline: `Simple data loading and caching utilities for apps`,
    description: `Simple and lightweight cached data loading designed for fetch-as-you-render patterns in React, Vue, Solid & Svelte. It's basically React Query lite!`,
    badge: (
      <div className="flex items-center justify-center whitespace-nowrap uppercase text-white bg-amber-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        Alpha
      </div>
    ),
  },
  {
    name: 'TanStack Actions',
    getStyles: () =>
      `shadow-xl shadow-lime-700/20 dark:shadow-lg dark:shadow-lime-500/30 text-lime-500 border-2 border-transparent hover:border-current`,
    // to: 'https://github.com/tannerlinsley/react-ranger',
    tagline: `Simple mutation management utilities for apps`,
    description: `Simple and lightweight action/mutation management utility for frameworks like React, Vue, Solid & Svelte.`,
    badge: (
      <div className="flex items-center justify-center whitespace-nowrap uppercase text-white bg-lime-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        Alpha
      </div>
    ),
  },
  {
    name: 'TanStack Store',
    getStyles: () =>
      `shadow-xl shadow-slate-700/20 dark:shadow-lg dark:shadow-slate-500/30 text-slate-600 border-2 border-transparent hover:border-current`,
    // to: 'https://github.com/tannerlinsley/react-ranger',
    tagline: `Framework agnostic data store with reactive framework adapters`,
    description: `The core data store that powers TanStack libraries and their framework adapters. Use it if you dare.`,
    badge: (
      <div className="flex items-center justify-center whitespace-nowrap uppercase text-white bg-slate-700 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        New
      </div>
    ),
  },
]

const courses = [
  {
    name: 'The Official TanStack React Query Course',
    getStyles: () => `border-t-4 border-red-500 hover:(border-green-500)`,
    href: 'https://ui.dev/checkout/react-query?from=tanstack',
    description: `Learn how to build enterprise quality apps with TanStack's React Query the easy way with our brand new course.`,
    price: `$195`,
  },
]

export const loader = async () => {
  const { getSponsorsForSponsorPack } = require('../server/sponsors')

  const sponsors = await getSponsorsForSponsorPack()

  return json({
    sponsors,
    randomNumber: Math.random(),
  })
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData()
  return fetch(`https://bytes.dev/api/bytes-optin-cors`, {
    method: 'POST',
    body: JSON.stringify({
      email: formData.get('email_address'),
      influencer: 'tanstack',
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

function sample(arr: any[], random = Math.random()) {
  return arr[Math.floor(random * arr.length)]
}

export default function Index() {
  const data = useActionData()
  const { sponsors, randomNumber } = useLoaderData<typeof loader>()
  const transition = useTransition()
  const isLoading = transition.state === 'submitting'
  const hasSubmitted = data?.status === 'success'
  const hasError = data?.status === 'error'

  const gradient = sample(gradients, randomNumber)

  return (
    <>
      <div
        className="flex flex-wrap py-2 px-4 items-center justify-center text-sm
          md:text-base md:justify-end"
      >
        {menu?.map((item, i) => {
          const label = (
            <div className="p-2 opacity-90 hover:opacity-100">{item.label}</div>
          )

          return (
            <div key={i} className="hover:underline">
              {item.to.startsWith('http') ? (
                <a href={item.to} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ) : (
                <Link to={item.to} prefetch="intent">
                  {label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-6 text-center px-4 py-12 lg:py-24">
        <h1
          className={`inline-block
            font-black text-5xl
            md:text-6xl
            lg:text-8xl`}
        >
          <span
            className={`
            inline-block text-transparent bg-clip-text bg-gradient-to-r ${gradient}
            underline decoration-8 underline-offset-[1rem] decoration-gray-200 dark:decoration-gray-800
            mb-2
            `}
          >
            TanStack
          </span>
        </h1>
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          High-quality open-source software for{' '}
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            web developers.
          </span>
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          Headless, type-safe, & powerful utilities for State Management,
          Routing, Data Visualization, Charts, Tables, and more.
        </p>
      </div>
      <div className="h-8" />
      <div className="px-4 lg:max-w-screen-lg md:mx-auto">
        <h3 className={`text-4xl font-light`}>Open Source Libraries</h3>
        <div
          className={`mt-4 grid grid-cols-1 gap-8
            sm:grid-cols-2 sm:gap-4
            lg:grid-cols-3`}
        >
          {libraries.map((library, i) => {
            return (
              <LinkOrA
                key={library.name}
                to={library.to ?? '#'}
                className={twMerge(
                  `border-4 border-transparent rounded-lg shadow-lg p-4 md:p-8 text-white transition-all bg-white dark:bg-gray-800`,
                  library.getStyles()
                )}
                style={{
                  zIndex: i,
                }}
                prefetch="intent"
              >
                <div className="flex gap-2 justify-between items-center">
                  <div className={`text-2xl font-extrabold `}>
                    {library.name}
                  </div>
                  {library.badge ?? null}
                </div>
                <div className={`text-lg italic font-light mt-2`}>
                  {library.tagline}
                </div>
                <div className={`text-sm mt-2 text-black dark:text-white`}>
                  {library.description}
                </div>
              </LinkOrA>
            )
          })}
        </div>
      </div>
      <div className="h-12" />
      <div className={`px-4 lg:max-w-screen-lg md:mx-auto`}>
        <div className={`grid grid-cols-1 gap-12 sm:grid-cols-2`}>
          <div className="flex flex-col gap-4">
            <h3 className={`text-4xl font-light`}>Partners</h3>
            <div
              className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
            >
              <div className="flex-1 bg-white flex items-center justify-center p-2">
                <a
                  href="https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={require('~/images/ag-grid.png')}
                    className="w-[250px] max-w-full"
                    width="250"
                    height="87"
                  />
                </a>
              </div>
              <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
                <div>
                  TanStack Table and AG Grid are respectfully the{' '}
                  <strong>best table/datagrid libraries around</strong>. Instead
                  of competing, we're working together to ensure the highest
                  quality table/datagrid options are available for the entire
                  JS/TS ecosystem and every use-case imaginable for UI/UX
                  developers.
                </div>
                <Link
                  to="/blog/ag-grid-partnership"
                  className="text-blue-500 uppercase font-black text-sm"
                  prefetch="intent"
                >
                  Learn More
                </Link>
              </div>
            </div>
            <div
              className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
            >
              <div className="flex-1 bg-white flex items-center justify-center p-2">
                <a
                  href="https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={require('~/images/nozzle.png')}
                    className="w-[230px] max-w-full my-2"
                    width="230"
                    height="80"
                  />
                </a>
              </div>
              <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
                <div>
                  For years, TanStack technologies have been used to power
                  Nozzle's SEO platform. As one of the{' '}
                  <strong>
                    most technically advanced search engine monitoring platforms
                  </strong>
                  , its enterprise rank tracking and keyword research tools are
                  setting a new bar for quality and scale. Nozzle uses the full
                  gamut of TanStack tools on the front-end to deliver users with
                  unmatched UI/UX.
                </div>
                <Link
                  to="/blog/ag-grid-partnership"
                  className="text-blue-500 uppercase font-black text-sm"
                  prefetch="intent"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className={`text-4xl font-light`}>Affiliates </h3>
            <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white">
              <Carbon />
            </div>
            <span
              className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500
                dark:bg-opacity-20 self-center"
            >
              This ad helps us keep the lights on 😉
            </span>
          </div>
        </div>
      </div>
      <div className="h-12" />
      <div className={`lg:max-w-screen-lg px-4 mx-auto`}>
        <h3 className={`text-4xl font-light`}>Courses</h3>
        <div className={`mt-4 grid grid-cols-1 gap-4`}>
          {courses.map((course) => (
            <a
              key={course.name}
              href={course.href}
              className={`flex gap-2 justify-between border-2 border-transparent rounded-lg p-4 md:p-8
              transition-all bg-white dark:bg-gray-800
              shadow-xl shadow-green-700/10 dark:shadow-green-500/30
              hover:border-green-500
              `}
              target="_blank"
              rel="noreferrer"
            >
              <div
                className={`col-span-2
                    md:col-span-5`}
              >
                <div className={`text-2xl font-bold text-green-500`}>
                  {course.name}
                </div>
                <div className={`text-sm mt-2`}>{course.description}</div>
                <div
                  className={`inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded shadow uppercase font-black text-sm`}
                >
                  Enroll →
                </div>
              </div>
              <div className={`flex-col text-center md:text-right`}>
                <div className={`text-center text-3xl font-bold`}>
                  {course.price}
                </div>
                <div className={`text-center text-sm opacity-70`}>
                  per license
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
      <div className="h-12" />
      <div className={`lg:max-w-screen-lg px-4 mx-auto`}>
        <h3 className={`text-4xl font-light`}>OSS Sponsors</h3>
        <div className="h-4" />
        <div
          style={{
            aspectRatio: '1/1',
          }}
        >
          <SponsorPack sponsors={sponsors} />
          {/* return (
                 <iframe
                   src={
                     process.env.NODE_ENV === 'production'
                       ? 'https://tanstack.com/sponsors-embed'
                       : 'http://localhost:3001/sponsors-embed'
                   }
                   loading="lazy"
                   style={{
                     width: width,
                     height: width,
                     overflow: 'hidden',
                   }}
                 />
               ) */}
        </div>
        <div className={`h-6`} />
        <div className={`text-center`}>
          <div>
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className={`inline-block p-4 bg-green-500 rounded text-white uppercase font-black`}
            >
              Become a Sponsor!
            </a>
          </div>
          <div className={`h-4`} />
          <p className={`italic mx-auto max-w-screen-sm text-gray-500`}>
            Sponsors get special perks like{' '}
            <strong>
              private discord channels, priority issue requests, direct support
              and even course vouchers
            </strong>
            !
          </p>
        </div>
      </div>
      <div className="h-12" />
      <div className="px-4 mx-auto max-w-screen-lg">
        <div
          className={`
          rounded-md p-4 grid gap-6
          bg-discord text-white overflow-hidden relative
          shadow-xl shadow-indigo-700/30
          sm:p-8 sm:grid-cols-3`}
        >
          <div
            className={`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:opacity-20`}
          >
            <img
              src={require('../images/discord-logo-white.svg')}
              width={300}
              height={300}
            />
          </div>
          <div className={`sm:col-span-2`}>
            <h3 className={`text-3xl`}>TanStack on Discord</h3>
            <p className={`mt-4`}>
              The official TanStack community to ask questions, network and make
              new friends and get lightning fast news about what's coming next
              for TanStack!
            </p>
          </div>
          <div className={`flex items-center justify-center`}>
            <a
              href="https://discord.com/invite/WrRKjPJ"
              target="_blank"
              rel="noreferrer"
              className={`block w-full mt-4 px-4 py-2 bg-white text-discord
                text-center rounded shadow-lg z-10 uppercase font-black`}
            >
              Join TanStack Discord
            </a>
          </div>
        </div>
      </div>
      <div className="h-4" />
      <div className="px-4 mx-auto max-w-screen-lg relative">
        <div className="rounded-md p-8 bg-white shadow-xl shadow-gray-900/10 md:p-14 dark:bg-gray-800">
          {!hasSubmitted ? (
            <Form method="post">
              <div>
                <div className={`relative inline-block`}>
                  <h3 className={`text-3xl`}>Subscribe to Bytes</h3>
                  <figure className={`absolute top-0 right-[-48px]`}>
                    <img
                      src={require('../images/bytes.svg')}
                      alt="Bytes Logo"
                      width={40}
                      height={40}
                    />
                  </figure>
                </div>

                <h3 className={`text-lg mt-1`}>
                  The Best Javascript Newletter
                </h3>
              </div>
              <div className={`grid grid-cols-3 mt-4 gap-2`}>
                <input
                  disabled={transition.state === 'submitting'}
                  className={`col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:(text-white bg-gray-700)`}
                  name="email_address"
                  placeholder="Your email address"
                  type="text"
                  required
                />
                <button
                  type="submit"
                  className={`bg-[#ED203D] text-white rounded uppercase font-black`}
                >
                  <span>{isLoading ? 'Loading ...' : 'Subscribe'}</span>
                </button>
              </div>
              {hasError ? (
                <p className={`text-sm text-red-500 font-semibold italic mt-2`}>
                  Looks like something went wrong. Please try again.
                </p>
              ) : (
                <p className={`text-sm opacity-30 font-semibold italic mt-2`}>
                  Join over 100,000 devs
                </p>
              )}
            </Form>
          ) : (
            <p>🎉 Thank you! Please confirm your email</p>
          )}
        </div>
      </div>
      <div className={`h-20`} />
      <Footer />
    </>
  )
}
