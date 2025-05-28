import { CgSpinner } from 'react-icons/cg'
import * as React from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { FaCheckCircle } from 'react-icons/fa'
import SponsorPack from '~/components/SponsorPack'
import { dbProject } from '~/libraries/db'
import { Await } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { twMerge } from 'tailwind-merge'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { partners } from '~/utils/partners'
import LandingPageGad from '~/components/LandingPageGad'

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
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <div className="flex flex-col items-center gap-6 text-center px-4">
          <h1 className="font-black flex gap-3 items-center text-4xl md:text-6xl lg:text-7xl xl:text-8xl uppercase [letter-spacing:-.05em]">
            <span>TanStack</span>
            <span className={twMerge(gradientText)}>DB</span>
          </h1>
          <h2
            className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
          >
            A{' '}
            <span className="underline decoration-dashed decoration-gray-500 decoration-3 underline-offset-2">
              reactive client store
            </span>{' '}
            for building{' '}
            <span className="underline decoration-dashed decoration-gray-500 decoration-3 underline-offset-2">
              super-fast
            </span>{' '}
            apps
          </h2>
          <p className="text opacity-90 max-w-[500px] lg:text-xl lg:max-w-[800px]">
            TanStack DB extends TanStack Query with collections, live queries
            and optimistic mutations that keep your app reactive, consistent
            and&nbsp;blazing fast 🔥
          </p>
          <Link
            to="/$libraryId/$version/docs"
            params={{ libraryId: library.id, version }}
            className={`py-2 px-4 bg-orange-500 rounded text-white uppercase font-extrabold`}
          >
            Coming soon &raquo;
          </Link>
        </div>
        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />
        <div className="px-4 sm:px-6 lg:px-8 mx-auto">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Blazing fast apps 🔥
            </h3>
            <p className="mt-6 text-xl w-3xl mx-auto leading-7 opacity-75 max-w-[500px] lg:max-w-[800px]">
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
          <div className="grid grid-flow-row grid-cols-2 gap-x-10 lg:gap-x-12 gap-y-4 mx-auto max-w-[500px] lg:max-w-[650px]">
            <div>
              <h4 className="text-xl my-2">🔥 Blazing fast query engine</h4>
              <p>For sub-millisecond live queries.</p>
            </div>
            <div>
              <h4 className="text-xl my-2">⚡ Instant local writes</h4>
              <p>With sync and lifecycle support.</p>
            </div>
            <div>
              <h4 className="text-xl my-2">🎯 Fine-grained reactivity</h4>
              <p>To minimize component re-rendering.</p>
            </div>
            <div>
              <h4 className="text-xl my-2">🌟 Normalized data</h4>
              <p>To keep your backend simple and fast.</p>
            </div>
          </div>
        </div>
        <div className="px-4 lg:max-w-screen-lg md:mx-auto mx-auto max-w-full">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
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
                    className="shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 bg-white dark:bg-black/40 dark:shadow-none group overflow-hidden grid"
                    rel="noreferrer"
                  >
                    <div className="z-0 row-start-1 col-start-1 flex items-center justify-center group-hover:blur-sm transition-all duration-200">
                      {partner.homepageImg}
                    </div>
                    <div className="z-10 row-start-1 col-start-1 max-w-full p-4 text-sm flex flex-col gap-4 items-start opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/70 dark:bg-gray-800/70">
                      {partner.content}
                    </div>
                  </a>
                )
              })}
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
            <Await
              promise={sponsorsPromise}
              fallback={<CgSpinner className="text-2xl animate-spin" />}
              children={(sponsors) => {
                return <SponsorPack sponsors={sponsors} />
              }}
            />
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
        <LandingPageGad />
        <div className="flex flex-col gap-4 items-center">
          <div className="font-extrabold text-xl lg:text-2xl">
            Wow, you've come a long way!
          </div>
          <div className="italic font-sm opacity-70">
            Only one thing left to do...
          </div>
          <div>
            <Link
              to="/$libraryId/$version/docs"
              params={{ libraryId: library.id, version }}
              className={`inline-block py-2 px-4 bg-stone-700 rounded text-white uppercase font-extrabold`}
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
