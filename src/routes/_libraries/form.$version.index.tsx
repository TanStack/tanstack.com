import { Await, getRouteApi, Link } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import SponsorPack from '~/components/SponsorPack'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { formProject } from '~/libraries/form'
import { seo } from '~/utils/seo'
import * as React from 'react'
import { CgSpinner } from 'react-icons/cg'
import { FaCheckCircle } from 'react-icons/fa'
import { TbHeartHandshake } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  component: FormVersionIndex,
  head: () => ({
    meta: seo({
      title: formProject.name,
      description: formProject.description,
    }),
  }),
})

const librariesRouteApi = getRouteApi('/_libraries')

const library = getLibrary('form')

export default function FormVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(formProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${formProject.colorFrom} ${formProject.colorTo}`

  return (
    <>
      <div className="flex max-w-full flex-col gap-20 pt-32 md:gap-32">
        <div className="flex flex-col items-center gap-8 px-4 text-center">
          <h1 className="flex items-center gap-3 text-4xl font-black [letter-spacing:-.05em] uppercase md:text-6xl lg:text-7xl xl:text-8xl">
            <span>TanStack</span>
            <span className={twMerge(gradientText)}>Form</span>
          </h1>
          <h2 className="max-w-[600px] text-2xl font-bold md:text-3xl lg:max-w-[800px] lg:text-5xl">
            <span className="underline decoration-yellow-500 decoration-dashed decoration-3 underline-offset-2">
              Headless, performant, and type-safe
            </span>{' '}
            form state management for TS/JS, React, Vue, Angular, Solid, Lit and
            Svelte
          </h2>
          <p className="text max-w-[500px] opacity-90 lg:max-w-[800px] lg:text-xl">
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
            to="/$libraryId/$version/docs"
            params={{ libraryId: library.id, version }}
            className={`rounded bg-yellow-400 px-4 py-2 font-extrabold text-black uppercase`}
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
              No dependencies. All the Features.
            </h3>
            <p className="mx-auto mt-4 max-w-3xl text-xl leading-7 opacity-60">
              With zero dependencies, TanStack Form is extremely lean given the
              dense feature set it provides. From weekend hobbies all the way to
              enterprise TanStack Form has the tools to help you succeed at the
              speed of your creativity.
            </p>
          </div>
          <div className="mx-auto grid grid-flow-row grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
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
              Form <TbHeartHandshake /> You?
            </span>
            <div className="flex flex-col gap-4 p-4">
              <div>
                We're looking for a TanStack Form OSS Partner to go above and
                beyond the call of sponsorship. Are you as invested in TanStack
                Form as we are? Let's push the boundaries of Form together!
              </div>
              <a
                href="mailto:partners@tanstack.com?subject=TanStack Form Partnership"
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

        <div className="flex flex-col gap-4">
          <div className="container mx-auto max-w-3xl px-4 sm:px-6 sm:text-center lg:px-8">
            <h3 className="mt-2 text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none">
              Less code, fewer edge cases.
            </h3>
            <p className="my-4 text-xl leading-7 text-gray-600">
              Instead of encouraging hasty abstractions and hook-focused APIs,
              TanStack Form embraces composition where it counts by giving you
              headless APIs via components (and hooks if you want them of
              course). TanStack Form is designed to be used directly in your
              components and UI. This means less code, fewer edge cases, and
              deeper control over your UI. Try it out with one of the examples
              below!
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {(
                [
                  { label: 'React', value: 'react' },
                  { label: 'Vue', value: 'vue' },
                  { label: 'Angular', value: 'angular' },
                  { label: 'Solid', value: 'solid' },
                  { label: 'Lit', value: 'lit' },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  className={`inline-block rounded px-4 py-2 font-extrabold text-black uppercase ${
                    item.value === framework
                      ? 'bg-yellow-500'
                      : 'bg-gray-300 hover:bg-yellow-400 dark:bg-gray-700'
                  }`}
                  onClick={() => setFramework(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-black">
          <iframe
            key={framework}
            src={`https://stackblitz.com/github/${
              formProject.repo
            }/tree/${branch}/examples/${framework}/simple?embed=1&theme=${
              isDark ? 'dark' : 'light'
            }&preset=node`}
            title={`tanstack//${framework}-form: simple`}
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            className="max-h-[800px] shadow-2xl"
            loading="lazy"
            style={{
              width: '100%',
              height: '80vh',
              border: '0',
            }}
          ></iframe>
        </div>

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
              className={`inline-block rounded bg-yellow-500 px-4 py-2 font-extrabold text-black uppercase`}
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
