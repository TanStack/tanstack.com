import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { getLibrary } from '~/libraries'
import { configProject } from '~/libraries/config'
import { seo } from '~/utils/seo'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { TbHeartHandshake } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  component: FormVersionIndex,
  head: () => ({
    meta: seo({
      title: configProject.name,
      description: configProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

export default function FormVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const library = getLibrary('config')

  const gradientText = `pr-1 inline-block leading-snug text-transparent bg-clip-text bg-gradient-to-r ${configProject.colorFrom} ${configProject.colorTo}`

  return (
    <>
      <div className="flex flex-col gap-20 pt-32 md:gap-32">
        <div className="flex flex-col items-center gap-8 px-4 text-center">
          <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
            <span>TanStack</span>
            <span className={twMerge(gradientText)}>Config</span>
          </h1>
          <h2 className="max-w-[600px] text-2xl font-bold md:text-3xl lg:max-w-[800px] lg:text-5xl">
            <span className="underline decoration-gray-500 decoration-dashed decoration-3 underline-offset-2">
              Configuration and tools
            </span>{' '}
            for publishing and maintaining high-quality JavaScript packages
          </h2>
          <Link
            to="./docs/"
            className={`rounded bg-gray-500 px-4 py-2 font-extrabold text-white uppercase`}
          >
            Get Started
          </Link>
        </div>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pb-16 sm:text-center">
            <h3 className="mx-auto mt-2 text-center text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none">
              Hassle-Free Setup
            </h3>
            <p className="mx-auto mt-4 max-w-3xl text-xl leading-7 opacity-60">
              Incorporate TanStack Config into your development toolkit and
              experience a new level of efficiency, speed, and customization in
              building and releasing high-quality JavaScript packages.
            </p>
          </div>
          <div className="mx-auto grid w-[max-content] grid-flow-row grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              // A list of features that @tanstack/config provides
              'Vite ecosystem',
              'Opinionated defaults',
              'Publint-compliant',
              'Minimal configuration',
              'Package versioning',
              'Automated changelogs',
            ].map((d, i) => {
              return (
                <span key={i} className="flex items-center gap-2">
                  <FaCheckCircle className="text-green-500" /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <div className="mx-auto w-[500px] max-w-full px-4">
          <h3 className="mt-8 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
            Partners
          </h3>
          <div className="h-8" />
          <div className="flex flex-1 flex-col items-center divide-y-2 divide-gray-500/10 overflow-hidden rounded-lg bg-white/80 text-center text-sm shadow-xl shadow-gray-500/20 dark:bg-black/40 dark:shadow-none">
            <span className="flex items-center gap-2 p-12 text-4xl font-black text-rose-500 uppercase">
              Config <TbHeartHandshake /> You?
            </span>
            <div className="flex flex-col gap-4 p-4">
              <div>
                We're looking for a TanStack Config OSS Partner to go above and
                beyond the call of sponsorship. Are you as invested in TanStack
                Config as we are? Let's push the boundaries of Config together!
              </div>
              <a
                href="mailto:partners@tanstack.com?subject=TanStack Config Partnership"
                className="text-sm font-black text-blue-500 uppercase"
              >
                Let's chat
              </a>
            </div>
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
              to="./docs/"
              className={`inline-block rounded bg-gray-500 px-4 py-2 font-extrabold text-white uppercase`}
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
