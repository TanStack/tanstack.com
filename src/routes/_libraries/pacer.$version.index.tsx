import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { getLibrary } from '~/libraries'
import { pacerProject } from '~/libraries/pacer'
import { partners } from '~/utils/partners'
import { seo } from '~/utils/seo'
import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { TbHeartHandshake } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  component: PacerVersionIndex,
  head: () => ({
    meta: seo({
      title: pacerProject.name,
      description: pacerProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')
const library = getLibrary('pacer')

export default function PacerVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()

  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${pacerProject.colorFrom} ${pacerProject.colorTo}`

  return (
    <>
      <div className="flex max-w-full flex-col gap-20 pt-32 md:gap-32">
        <div className="flex flex-col items-center gap-6 px-4 text-center">
          <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
            <span>TanStack</span>
            <span className={twMerge(gradientText)}>Pacer</span>
          </h1>
          <h2 className="max-w-md text-2xl font-bold md:text-3xl lg:max-w-2xl lg:text-5xl">
            <span className="underline decoration-gray-500 decoration-dashed decoration-3 underline-offset-2">
              Framework agnostic
            </span>{' '}
            type-safe rate-limiting and queueing utilities
          </h2>
          <p className="text max-w-[500px] opacity-90 lg:max-w-[800px] lg:text-xl">
            Take control of your application's timing with TanStack Pacer's{' '}
            <strong>rate limiting, throttling, and debouncing utilities</strong>
            . Manage complex async workflows using{' '}
            <strong>intelligent queuing and concurrency controls</strong> while
            maintaining full control with built-in pause, resume, and cancel
            capabilities.
          </p>
          <Link
            to="/$libraryId/$version/docs"
            params={{ libraryId: library.id, version }}
            className={`rounded bg-stone-600 px-4 py-2 font-extrabold text-white uppercase`}
          >
            Get Started
          </Link>
        </div>
        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pb-16 sm:text-center">
            <h3 className="mx-auto mt-2 text-center text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none">
              Framework Agnostic & Feature Rich
            </h3>
            <p className="mx-auto mt-4 max-w-3xl text-xl leading-7 opacity-60">
              TanStack Pacer's API is highly modular and framework-independent
              while still prioritizing ergonomics. Behold, the obligatory
              feature-list:
            </p>
          </div>
          <div className="mx-auto grid grid-flow-row grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[
              'Lightweight',
              'Tree-Shaking',
              'Type-Safe',
              'Rate Limiting',
              'Throttling',
              'Debouncing',
              'Queueing',
              'LIFO/FIFO/Dequeue Ordering',
              'Concurrency Control',
              'Queue Prioritization',
              'Pause/Resume Controls',
              'Cancellation',
              'Abort Controller Support',
              'Promise Integration',
              'Multiple Layers of Abstraction',
            ].map((d, i) => {
              return (
                <span key={i} className="flex items-center gap-2">
                  <FaCheckCircle className="text-green-500" /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <div className="mx-auto max-w-full px-4 md:mx-auto lg:max-w-screen-lg">
          <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
            Partners
          </h3>
          <div className="h-8" />
          <div className={`w-[500px] max-w-full`}>
            {partners
              .filter((d) => d.libraries?.includes('pacer'))
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

        {/* <div className="flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
            <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
              Take it for a spin!
            </h3>
            <p className="my-4 text-xl leading-7 text-gray-600">
              With just a few lines of code, you can start using powerful rate
              limiting, throttling, debouncing, and queueing utilities.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(
                [
                  { label: 'React', value: 'react' },
                  // More adapters coming soon
                  // { label: 'Solid', value: 'solid' },
                  // { label: 'Svelte', value: 'svelte' },
                  // { label: 'Vue', value: 'vue' },
                  // { label: 'Vanilla', value: 'vanilla' },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  className={`inline-block py-2 px-4 rounded text-white uppercase font-extrabold bg-stone-600`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-black">
          <iframe
            src={`https://stackblitz.com/github/${pacerProject.repo}/tree/main/examples/react/useDebouncer?embed=1&theme=dark&preset=node&file=src/main.tsx`}
            title="tanstack/pacer: useDebouncer"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            className="shadow-2xl"
            loading="lazy"
            style={{
              width: '100%',
              height: '80vh',
              border: '0',
            }}
          ></iframe>
        </div> */}

        <div className="flex flex-col items-center gap-4">
          <div className="text-xl font-extrabold lg:text-2xl">
            Wow, you've come a long way!
          </div>
          <div className="font-sm italic opacity-70">
            Only one thing left to do...
          </div>
          <div>
            <Link
              to="/$libraryId/$version/docs"
              params={{ libraryId: library.id, version }}
              className={`inline-block rounded bg-stone-700 px-4 py-2 font-extrabold text-white uppercase`}
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
