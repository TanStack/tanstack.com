import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { TbHeartHandshake } from 'react-icons/tb'
import SponsorPack from '~/components/SponsorPack'
import { devtoolsProject } from '~/libraries/devtools'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { Await, Link, getRouteApi } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { twMerge } from 'tailwind-merge'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnershipCallout } from '~/components/PartnershipCallout'

export const Route = createFileRoute({
  component: DevtoolsVersionIndex,
  head: () => ({
    meta: seo({
      title: devtoolsProject.name,
      description: devtoolsProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

export default function DevtoolsVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const library = getLibrary('devtools')

  const gradientText = `pr-1 inline-block leading-snug text-transparent bg-clip-text bg-linear-to-r ${devtoolsProject.colorFrom} ${devtoolsProject.colorTo}`

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 pt-32">
        <div className="flex flex-col items-center gap-8 text-center px-4">
          <h1 className="font-black flex flex-wrap justify-center gap-3 items-center text-4xl md:text-6xl lg:text-7xl xl:text-8xl uppercase [letter-spacing:-.05em]">
            <span>TanStack</span>
            <span className={twMerge(gradientText)}>Devtools</span>
          </h1>
          <div
            className={twMerge(
              'text-sm',
              'md:text-base font-black',
              'lg:text-lg align-super text-white animate-bounce uppercase',
              'dark:text-black bg-black dark:bg-white shadow-xl shadow-black/30 px-2 py-1 rounded-md',
              'whitespace-nowrap'
            )}
          >
            STATUS: ALPHA
          </div>
          <h2
            className="font-bold text-2xl max-w-[600px]
            md:text-3xl
            lg:text-5xl lg:max-w-[800px]"
          >
            <span className="underline decoration-dashed decoration-gray-500 decoration-3 underline-offset-2">
              Centralized devtools panel
            </span>{' '}
            for TanStack libraries and custom devtools
          </h2>
          <p
            className="text opacity-90 max-w-[500px]
            lg:text-xl lg:max-w-[800px]"
          >
            A unified devtools panel that houses all TanStack devtools and
            allows you to create and integrate your own custom devtools. Built
            with <strong>Solid.js for lightweight performance</strong> but
            designed to work with any framework.
          </p>
          <Link
            to="./docs/"
            className={`py-2 px-4 bg-slate-500 hover:bg-slate-600 text-white rounded uppercase font-extrabold transition-colors`}
          >
            Get Started
          </Link>
        </div>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Unified Development Experience
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              TanStack Devtools brings together all your development tools in
              one place, making debugging and development more efficient than
              ever before.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-max mx-auto">
            {[
              'Centralized Panel',
              'Framework Agnostic',
              'Custom Devtools',
              'Lightweight',
              'Solid.js Powered',
              'Extensible API',
              'Type Safe',
              'Plugin System',
              'Real-time Updates',
            ].map((d, i) => {
              return (
                <span key={i} className="flex items-center gap-2">
                  <FaCheckCircle className="text-green-500 " /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto mx-auto">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
            Partners
          </h3>
          <div className="h-8" />
          <PartnershipCallout libraryName="Devtools" />
        </div>

        <div className="relative text-lg overflow-hidden">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
            Sponsors
          </h3>
          <div
            className="my-4 flex flex-wrap mx-auto max-w-(--breakpoint-lg)"
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
              to="./docs/"
              className={`inline-block py-2 px-4 bg-slate-500 hover:bg-slate-600 text-white rounded uppercase font-extrabold transition-colors`}
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
