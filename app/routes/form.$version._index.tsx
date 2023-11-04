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
import type { Framework } from '~/routes/form'
import { getBranch, gradientText, latestVersion, repo } from '~/routes/form'
import { Logo } from '~/components/Logo'

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
    to: './docs/react/examples/simple',
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
              <span className={gradientText}>TanStack Form</span>{' '}
              <span
                className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
              >
                {version === 'latest' ? latestVersion : version}
              </span>
            </h1>
          </div>
          <h2
            className="font-bold text-2xl max-w-[600px]
            md:text-3xl
            lg:text-5xl lg:max-w-[800px]"
          >
            <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
              Headless, performant, and type-safe
            </span>{' '}
            form state management for TS/JS, React, Solid, Svelte and Vue
          </h2>
          <p
            className="text opacity-90 max-w-[500px]
            lg:text-xl lg:max-w-[800px]"
          >
            Stop crying over your forms with a return to simplicity,
            composability and type-safety with TanStack Form. Sporting a{' '}
            <strong>
              tiny footprint, zero dependencies, framework agnostic core and
              granular type-safe APIs
            </strong>
            , TanStack Form is the perfect combination of simplicity and power
            you need to build forms fast with peace of mind.
          </p>
          <Link
            to="./docs/"
            className={`py-2 px-4 bg-yellow-400 text-black rounded uppercase font-extrabold`}
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
            <VscWand className="text-yellow-400 text-6xl" />
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                First-Class TypeScript Support
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                TanStack Form touts first-class TypeScript support with
                outstanding autocompletion, excellent generic throughput and
                inferred types everywhere possible.{' '}
                <span className="font-semibold text-yellow-600 dark:text-yellow-300">
                  This results in fewer runtime errors, increased code
                  maintainability, and a smoother development experience
                </span>{' '}
                to help you confidently build robust and type-safe form
                solutions that scale.
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-8 items-center">
            <div className="text-center">
              <FaBolt className="text-yellow-500 text-6xl" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Headless and Framework Agnostic
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                Form's headless and framework agnostic approach ensures maximum
                flexibility and broad compatibility with many front-end
                frameworks, or no framework at all. By both supplying and
                encouraging a headless approach to your forms, building custom
                reusable form components tailored to your application's needs{' '}
                <span className="font-semibold text-amber-600 dark:text-yellow-500">
                  requires little abstraction and keeps your code modular,
                  simple and composable.
                </span>
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-8 items-center">
            <div className="text-center">
              <FaCogs className="text-amber-500 text-6xl" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Granular Reactive Performance
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                When it comes to performance, TanStack Form delivers amazing
                speed and control, but without the cruft, boilerplate, or
                abstractions. With granularly reactive APIs at its core,{' '}
                <span className="font-semibold text-amber-700 dark:text-amber-500">
                  only relevant components are updated when the form state
                  changes.
                </span>{' '}
                The end result? A faster UI, happy users, and zero worries about
                performance.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              No dependencies. All the Features.
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              With zero dependencies, TanStack Form is extremely lean given the
              dense feature set it provides. From weekend hobbies all the way to
              enterprise TanStack Form has the tools to help you succeed at the
              speed of your creativity.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-[max-content] mx-auto">
            {[
              // A list of features that @tanstack/form provides for managing form state, validation, touched/dirty states, UI integration, etc.
              'Framework agnostic design',
              'First Class TypeScript Support',
              'Headless',
              'Tiny / Zero Deps',
              'Granularly Reactive Components/Hooks',
              'Extensibility and plugin architecture',
              'Modular architecture',
              'Form/Field validation',
              'Async Validation',
              'Built-in Async Validation Debouncing',
              'Configurable Validation Events',
              'Deeply Nested Object/Array Fields',
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
              Form <TbHeartHandshake /> You?
            </span>
            <div className="flex flex-col p-4 gap-4">
              <div>
                We're looking for a TanStack Form OSS Partner to go above and
                beyond the call of sponsorship. Are you as invested in TanStack
                Form as we are? Let's push the boundaries of Form together!
              </div>
              <a
                href="mailto:partners@tanstack.com?subject=TanStack Form Partnership"
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
              Instead of encouraging hasty abstractions and hook-focused APIs,
              TanStack Form embraces composition where it counts by giving you
              headless APIs via components (and hooks if you want them of
              course). TanStack Form is designed to be used directly in your
              components and UI. This means less code, fewer edge cases, and
              deeper control over your UI. Try it out with one of the examples
              below!
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
                  className={`inline-block py-2 px-4 rounded text-black uppercase font-extrabold ${
                    item.value === framework
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-yellow-400'
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

        {['solid', 'vue', 'svelte'].includes(framework) ? (
          <div className="px-2">
            <div className="p-8 text-center text-lg w-full max-w-screen-lg mx-auto bg-black text-white rounded-xl">
              Looking for the <strong>@tanstack/{framework}-form</strong>{' '}
              example? We could use your help to build the{' '}
              <strong>@tanstack/{framework}-form</strong> adapter! Join the{' '}
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
              src={`https://codesandbox.io/embed/github/${repo}/tree/${branch}/examples/${framework}/simple?autoresize=1&fontsize=16&theme=${
                isDark ? 'dark' : 'light'
              }`}
              title={`tanstack//${framework}-form: simple`}
              sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              className="shadow-2xl max-h-[800px]"
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
              className={`inline-block py-2 px-4 bg-yellow-500 rounded text-black uppercase font-extrabold`}
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
