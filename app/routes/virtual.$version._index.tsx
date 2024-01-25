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
import { Link, useLoaderData } from '@remix-run/react'
import { json } from '@remix-run/node'
import { gradientText, getBranch } from '~/projects/virtual'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { IoIosBody } from 'react-icons/io'
import SponsorPack from '~/components/SponsorPack'
import { TbHeartHandshake } from 'react-icons/tb'
import { VscPreview } from 'react-icons/vsc'
import { Logo } from '~/components/Logo'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import type { LoaderFunctionArgs } from '@remix-run/node'
import type { Framework } from '~/projects/virtual'

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
        <FaGithub className="text-lg" /> GitHub
      </div>
    ),
    to: 'https://github.com/tanstack/virtual',
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

export const loader = async (context: LoaderFunctionArgs) => {
  const sponsors = await getSponsorsForSponsorPack()
  const { version } = context.params

  return json({
    sponsors,
    version,
  })
}

export default function ReactTableRoute() {
  const { sponsors, version } = useLoaderData<typeof loader>()
  const [framework, setFramework] = React.useState<Framework>('react')
  const branch = getBranch(version)
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
      <div className="flex flex-col items-center gap-8 text-center px-4">
        <div className="flex gap-2 lg:gap-4 items-center">
          <Logo className="w-[40px] md:w-[60px] lg:w-[100px]" />
          <h1
            className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl`}
          >
            <span className={gradientText}>TanStack Virtual</span>{' '}
            <span
              className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
            >
              v3
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
          UI for Virtualizing Large Element Lists
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          Virtualize only the visible DOM nodes within massive scrollable
          elements at 60FPS in TS/JS, React, Vue, Solid & Svelte while retaining
          100% control over markup and styles.
        </p>
        <Link
          to="./docs/guide/introduction"
          className={`py-2 px-4 bg-pink-500 rounded text-white uppercase font-extrabold`}
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
          <div className="text-center overflow-hidden">
            <IoIosBody className="text-rose-500 text-6xl -mt-5 mb-5 scale-125 origin-top" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Designed for zero design
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Headless Virtualization means you're always in control of your{' '}
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                markup, styles and components
              </span>
              . Go design and implement the most beautiful UI you can dream up
              and let us take care of the hard parts.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaBolt className="text-pink-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Big Power, Small Package
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Don't be fooled by the small bundle size. TanStack Virtual uses
              every byte to deliver powerful performance. After all,{' '}
              <span className="font-semibold text-pink-700 dark:text-pink-400">
                {' '}
                60FPS is table stakes
              </span>{' '}
              these days and we refuse to sacrifice anything for that 🧈-y
              smooth UX.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaCogs className="text-violet-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Maximum Composability
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              With a single function/hook, you'll get limitless virtualization
              for{' '}
              <span className="font-semibold text-violet-700 dark:text-violet-400">
                vertical, horizontal, and grid-style{' '}
              </span>
              layouts. The API is tiny (literally 1 function), but its
              composability is not.
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
            TanStack Table's API and engine are highly modular and
            framework-independent while still prioritizing ergonomics. Behold,
            the obligatory feature-list:
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4 w-[max-content] mx-auto">
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
            Virtual <TbHeartHandshake /> You?
          </span>
          <div className="flex flex-col p-4 gap-4">
            <div>
              We're looking for a TanStack Virtual OSS Partner to go above and
              beyond the call of sponsorship. Are you as invested in TanStack
              Virtual as we are? Let's push the boundaries of Virtual together!
            </div>
            <a
              href="mailto:partners@tanstack.com?subject=TanStack Virtual Partnership"
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
            With just a few divs and some inline styles, you're already well on
            your way to creating an extremely powerful virtualization
            experience.
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
            Looking for the <strong>@tanstack/{framework}-virtual</strong>{' '}
            example? We could use your help to build the{' '}
            <strong>@tanstack/{framework}-virtual</strong> adapter! Join the{' '}
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
            src={`https://codesandbox.io/embed/github/tanstack/virtual/tree/${branch}/examples/${framework}/dynamic?autoresize=1&fontsize=16&theme=${
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
            className={`inline-block py-2 px-4 bg-pink-500 rounded text-white uppercase font-extrabold`}
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
