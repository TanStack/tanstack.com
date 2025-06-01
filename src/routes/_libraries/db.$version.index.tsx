import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { getLibrary } from '~/libraries'
import { dbProject } from '~/libraries/db'
import { partners } from '~/utils/partners'
import { seo } from '~/utils/seo'
import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  component: DBVersionIndex,
  head: () => ({
    meta: seo({
      title: dbProject.name,
      description: dbProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')
const library = getLibrary('db')

export default function DBVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()

  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${dbProject.colorFrom} ${dbProject.colorTo}`

  return (
    <>
      <div className="flex max-w-full flex-col gap-20 pt-32 md:gap-32">
        <div className="flex flex-col items-center gap-6 px-4 text-center">
          <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
            <span>TanStack</span>
            <span className={twMerge(gradientText)}>DB</span>
          </h1>
          <h2 className="max-w-md text-2xl font-bold md:text-3xl lg:max-w-2xl lg:text-5xl">
            A{' '}
            <span className="underline decoration-gray-500 decoration-dashed decoration-3 underline-offset-2">
              reactive client store
            </span>{' '}
            for building{' '}
            <span className="underline decoration-gray-500 decoration-dashed decoration-3 underline-offset-2">
              super-fast
            </span>{' '}
            apps
          </h2>
          <p className="text max-w-[500px] opacity-90 lg:max-w-[800px] lg:text-xl">
            TanStack DB extends TanStack Query with collections, live queries
            and optimistic mutations that keep your app reactive, consistent
            and&nbsp;blazing fast 🔥
          </p>
          <Link
            to="/$libraryId/$version/docs"
            params={{ libraryId: library.id, version }}
            className={`rounded bg-orange-500 px-4 py-2 font-extrabold text-white uppercase`}
          >
            Coming soon &raquo;
          </Link>
        </div>
        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pb-16 sm:text-center">
            <h3 className="mx-auto mt-2 text-center text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none">
              Blazing fast apps 🔥
            </h3>
            <p className="mx-auto mt-6 w-3xl max-w-[500px] text-xl leading-7 opacity-75 lg:max-w-[800px]">
              Built on a{' '}
              <a
                href="https://github.com/electric-sql/d2ts"
                className="text-orange-400"
              >
                Typescript implementation of differential dataflow
              </a>
              , TanStack DB gives you real-time sync, live queries and local
              writes. With no stale data, super fast re-rendering and
              sub-millisecond cross-collection queries — even for large complex
              apps.
            </p>
          </div>
          <div className="mx-auto grid max-w-[500px] grid-flow-row grid-cols-2 gap-x-10 gap-y-4 lg:max-w-[650px] lg:gap-x-12">
            <div>
              <h4 className="my-2 text-xl">🔥 Blazing fast query engine</h4>
              <p>For sub-millisecond live queries.</p>
            </div>
            <div>
              <h4 className="my-2 text-xl">⚡ Instant local writes</h4>
              <p>With sync and lifecycle support.</p>
            </div>
            <div>
              <h4 className="my-2 text-xl">🎯 Fine-grained reactivity</h4>
              <p>To minimize component re-rendering.</p>
            </div>
            <div>
              <h4 className="my-2 text-xl">🌟 Normalized data</h4>
              <p>To keep your backend simple and fast.</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-full px-4 md:mx-auto lg:max-w-screen-lg">
          <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
            Partners
          </h3>
          <div className="h-8" />
          <div className={`w-[500px] max-w-full`}>
            {partners
              .filter((d) => d.libraries?.includes('db'))
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
