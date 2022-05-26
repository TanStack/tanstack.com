import {
  ActionFunction,
  Form,
  Link,
  MetaFunction,
  useActionData,
  useTransition,
} from 'remix'
import { Carbon } from '~/components/Carbon'
import { ParentSize } from '@visx/responsive'
import { twMerge } from 'tailwind-merge'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { CgMusicSpeaker } from 'react-icons/cg'
import { Footer } from '~/components/Footer'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-blue-500 to-green-500'

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

const libraries = [
  {
    name: 'React Query',
    getStyles: () =>
      `shadow-xl shadow-red-700/20 dark:shadow-lg dark:shadow-red-500/30 text-red-500 border-2 border-transparent hover:border-current`,
    to: 'https://react-query.tanstack.com',
    tagline: `Performant and powerful data synchronization for React`,
    description: `Fetch, cache and update data in your React and React Native applications all without touching any "global state".`,
  },
  {
    name: 'TanStack Table',
    getStyles: () =>
      `shadow-xl shadow-blue-700/20 dark:shadow-lg dark:shadow-blue-500/30 text-blue-500 border-2 border-transparent hover:border-current`,
    to: '/table',
    tagline: `Headless UI for building powerful tables & datagrids`,
    description: `Supercharge your tables or build a datagrid from scratch for TS/JS, React, Vue, Solid & Svelte while retaining 100% control over markup and styles.`,
    badge: (
      <div className="uppercase text-white bg-blue-500 rounded-full px-2 py-1 text-xs font-black animate-pulse">
        New
      </div>
    ),
  },
  {
    name: 'React Charts',
    getStyles: () =>
      `shadow-xl shadow-yellow-700/20 dark:shadow-lg dark:shadow-yellow-500/30 text-yellow-600 border-2 border-transparent hover:border-current`,
    to: 'https://react-charts.tanstack.com',
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
  },
  {
    name: 'React Location',
    getStyles: () =>
      `shadow-xl shadow-green-700/20 dark:shadow-lg dark:shadow-green-500/30 text-green-600 border-2 border-transparent hover:border-current`,
    to: 'https://react-location.tanstack.com',
    tagline: `Enterprise routing for React applications`,
    description: `Powerful, enterprise-grade routing including first-class URL Search APIs, declarative/suspendable route loaders & code-splitting and more.`,
  },
  {
    name: 'React Virtual',
    getStyles: () =>
      `shadow-xl shadow-purple-700/20 dark:shadow-lg dark:shadow-purple-500/30 text-purple-500 border-2 border-transparent hover:border-current`,
    to: 'https://react-virtual.tanstack.com',
    tagline: `Auto-sizing, buttery smooth headless virtualization... with just one hook.`,
    description: `Oh, did we mention it supports vertical, horizontal, grid, fixed, variable, dynamic, smooth and infinite virtualization too?`,
  },
  {
    name: 'React Ranger',
    getStyles: () =>
      `shadow-xl shadow-pink-700/20 dark:shadow-lg dark:shadow-pink-500/30 text-pink-500 border-2 border-transparent hover:border-current`,
    to: 'https://github.com/tannerlinsley/react-ranger',
    tagline: `Headless range and multi-range slider utilities.`,
    description: `React ranger supplies the primitive range and multi-range slider logic as a headless API that can be attached to any styles or markup fo that perfect design.`,
  },
]

const courses = [
  {
    name: 'The Official React Query Course',
    getStyles: () => `border-t-4 border-red-500 hover:(border-green-500)`,
    href: 'https://ui.dev/checkout/react-query?from=tanstack',
    description: `Learn how to build enterprise quality apps with React Query the easy way with our brand new course.`,
    price: `$149`,
  },
]

export let meta: MetaFunction = () => {
  const title = 'Quality Software & Open Source Libraries for the Modern Web'
  const description = `TanStack is an incubator and collection of software, products, tools and courses for building professional and enterprise-grade front-end applications for the web.`
  const imageHref = 'https://tanstack.com/favicon.png'
  return {
    title,
    description,
    keywords:
      'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software',
    'twitter:image': imageHref,
    'twitter:card': 'summary_large_image',
    'twitter:creator': '@tannerlinsley',
    'twitter:site': '@tannerlinsley',
    'twitter:title': 'TanStack',
    'twitter:description': description,
    'og:type': 'website',
    'og:title': title,
    'og:description': description,
    'og:image': imageHref,
  }
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

export default function Index() {
  const data = useActionData()
  const transition = useTransition()
  const isLoading = transition.state === 'submitting'
  const hasSubmitted = data?.status === 'success'
  const hasError = data?.status === 'error'

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
          <span className={gradientText}>TanStack</span>
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
          Headless, type-safe, powerful utilities for complex workflows like
          Data Management, Data Visualization, Charts, Tables, and UI Components
        </p>
      </div>
      <div className="h-8" />
      <div className="px-4 lg:max-w-screen-lg md:mx-auto">
        <h3 className={`text-3xl font-light`}>Open Source Libraries</h3>
        <div
          className={`mt-4 grid grid-cols-1 gap-8
            sm:grid-cols-2 sm:gap-4
            lg:grid-cols-3`}
        >
          {libraries.map((library, i) => {
            const Comp = library.to.startsWith('http') ? 'a' : Link
            return (
              <Comp
                key={library.name}
                to={library.to}
                href={library.to.startsWith('http') ? library.to : undefined}
                className={twMerge(
                  `border-4 border-transparent rounded-lg shadow-lg p-4 md:p-8 text-white transition-all bg-white dark:bg-gray-900`,
                  library.getStyles()
                )}
                style={{
                  zIndex: i,
                }}
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
              </Comp>
            )
          })}
        </div>
      </div>
      <div className="h-12" />
      <div className={`px-4 lg:max-w-screen-lg md:mx-auto`}>
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2`}>
          <div className="flex flex-col gap-4">
            <h3 className={`text-4xl font-light`}>Partners</h3>
            <div
              className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-900 dark:shadow-none"
            >
              <div className="flex-1 bg-white flex items-center justify-center p-2">
                <a
                  href="https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable"
                  target="_blank"
                >
                  <img
                    src={require('~/images/ag-grid.png')}
                    className="w-[250px] max-w-full"
                  />
                </a>
              </div>
              <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
                <div>
                  TanStack Table and AG Grid are respectfully the{' '}
                  <strong>best table/datagrid libraries around</strong>. Instead
                  of competing, we're working together to ensure the highest
                  quality table/datagrid options are available for the entire
                  JS/TS ecosystem and every use-case.
                </div>
                <Link
                  to="/blog/ag-grid-partnership"
                  className="text-blue-500 uppercase font-black text-sm"
                >
                  Read More
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className={`text-4xl font-light`}>Affiliates </h3>
            <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-900 dark:text-white">
              <Carbon />
            </div>
            <span
              className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500
                dark:bg-opacity-20 self-end"
            >
              This ad help us keep the lights on 😉
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
              transition-all bg-white dark:bg-gray-900
              shadow-xl shadow-green-700/10 dark:shadow-green-500/30
              hover:border-green-500
              `}
              target="_blank"
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
        <div className={`mt-4 overflow-hidden`}>
          <ParentSize>
            {({ width }) => {
              return (
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
              )
            }}
          </ParentSize>
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
                  Join over 76,000 devs
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
