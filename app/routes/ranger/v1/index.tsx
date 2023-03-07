import * as React from 'react'

import { CgCornerUpLeft } from 'react-icons/cg'
import { FaBook, FaCheckCircle, FaDiscord, FaGithub } from 'react-icons/fa'
import { Link, useLoaderData } from '@remix-run/react'
import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { v1branch } from '../v1'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import SponsorPack from '~/components/SponsorPack'
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
    to: './docs/overview',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> GitHub
      </div>
    ),
    to: 'https://github.com/tanstack/ranger',
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

export default function TanStackRangerRoute() {
  const { sponsors } = useLoaderData()
  const [framework, setFramework] = React.useState<
    'react' | 'preact' | 'svelte' | 'vue' | 'solid'
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
          <span className={gradientText}>TanStack Ranger</span>{' '}
          <span
            className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
          >
            BETA
          </span>
        </h1>
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          Modern and{' '}
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            headless
          </span>{' '}
          ranger ui library
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          A fully typesafe ranger hooks for React.
        </p>
        <Link
          to="./docs/overview"
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
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              Typesafe & powerful, yet familiarly simple
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Hooks for building range and multi-range sliders in React{' '}
              <span className="font-semibold text-lime-600 dark:text-lime-400">
                100% typesafe without compromising on DX
              </span>
              .
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
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              "Headless" UI library
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Headless utility, which means out of the box, it doesn't render or supply any actual UI elements
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <TbZoomQuestion className="text-emerald-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              Extensible
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              UI presents countless edge cases for a library simply because it's a creative medium, and one where every developer does things differently. By not dictating UI concerns, React Ranger empowers the developer to design and extend the UI based on their unique use-case.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            Feature Rich and Lightweight Headless utility, which means out of the box, it doesn't render or supply any actual UI elements.
          </h3>
          <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
            Behold, the obligatory feature-list:
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-[max-content] mx-auto">
          {[
            '100% Typesafe',
            'Lightweight (10kb)',
            'Easy to maintain',
            'Extensible',
            'Not dictating UI',
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 " /> {d}
              </span>
            )
          })}
        </div>
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
            Router <TbHeartHandshake /> You?
          </span>
          <div className="flex flex-col p-4 gap-4">
            <div>
              We're looking for a TanStack Ranger OSS Partner to go above and
              beyond the call of sponsorship. Are you as invested in TanStack
              Ranger as we are? Let's push the boundaries of Ranger together!
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
            Let's see it in action!
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
          src={`https://codesandbox.io/embed/github/tanstack/ranger/tree/${v1branch}/examples/${framework}/basic?autoresize=1&fontsize=16&theme=${
            isDark ? 'dark' : 'light'
          }`}
          title="tannerlinsley/react-ranger: basic"
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
      {/* )} */}

      <div className="flex flex-col gap-4 items-center">
        <div className="font-extrabold text-xl lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="italic font-sm opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="./docs/overview"
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
