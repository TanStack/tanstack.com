import * as React from 'react'

import { CgCornerUpLeft, CgSpinner } from 'react-icons/cg'
import { PiTreeStructureBold, PiRocketLaunchDuotone } from 'react-icons/pi'
import { TbServerBolt } from 'react-icons/tb'
import {
  FaBook,
  FaDiscord,
  FaGithub,
  FaTshirt,
  FaTwitter,
  FaYinYang,
} from 'react-icons/fa'
import { Await, Link, getRouteApi } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { TbZoomQuestion } from 'react-icons/tb'
import SponsorPack from '~/components/SponsorPack'
import { startProject } from '~/libraries/start'
import { createFileRoute } from '@tanstack/react-router'
import { Framework, getBranch } from '~/libraries'
import { seo } from '~/utils/seo'
import { partners } from '~/utils/partners'
import { VscPreview } from 'react-icons/vsc'

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
    to: '../../router/latest/docs/framework/react/examples/start-basic',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaBook className="text-lg" /> Docs
      </div>
    ),
    to: '../../router/latest/docs/framework/react/start/overview',
  },
  // {
  //   label: (
  //     <div className="flex items-center gap-1">
  //       <FaGithub className="text-lg" /> GitHub
  //     </div>
  //   ),
  //   to: `https://github.com/${startProject.repo}`,
  // },
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

export const Route = createFileRoute('/_libraries/start/$version/')({
  component: VersionIndex,
  meta: () =>
    seo({
      title: startProject.name,
      description: startProject.description,
    }),
})

const librariesRouteApi = getRouteApi('/_libraries')

export default function VersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(startProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    if (isDark) {
      //
    }
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const gradientText = `inline-block text-transparent bg-clip-text bg-gradient-to-r ${startProject.colorFrom} ${startProject.colorTo}`

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full">
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
                <Link to={item.to} params>
                  {label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-8 text-center px-4">
        <div className="flex gap-2 lg:gap-4 items-center">
          <h1
            className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl relative`}
            style={{
              viewTransitionName: `library-name`,
            }}
          >
            <span className={gradientText}>TanStack Start</span>
          </h1>
        </div>
        {/* <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[150%]"> */}
        <div
          className="text-sm
            md:text-base font-black
            lg:text-lg align-super text-white animate-bounce uppercase
              dark:text-black bg-black dark:bg-white shadow-xl shadow-black/30 px-2 py-1 rounded-md
              leading-none whitespace-nowrap"
        >
          It's Almost ready!
          {/* {version === 'latest' ? latestVersion : version} */}
        </div>
        {/* </div> */}
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          Full-stack React framework{' '}
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            powered by TanStack Router
          </span>{' '}
        </h2>
        <p
          className="text opacity-90 max-w-[500px]
            lg:text-xl lg:max-w-[600px]"
        >
          Full-document SSR, Streaming, Server Functions, bundling and more,
          powered by <strong>TanStack Router</strong>, <strong>Vinxi</strong>,
          and <strong>Vite</strong>. Ready to deploy to your favorite hosting
          provider.
        </p>
      </div>
      <div className="text-lg grid gap-12 p-8 max-w-[1200px] mx-auto md:grid-cols-2 xl:grid-cols-4">
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <PiTreeStructureBold
              className="text-cyan-700 dark:text-cyan-500 text-6xl motion-safe:animate-pulse"
              style={{
                animationDuration: '5s',
                animationTimingFunction: 'ease-in-out',
              }}
            />
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              Enterprise-Grade Routing
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Built on TanStack Router, Start comes pre-packed with a{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-500">
                fully type-safe and powerfully-unmatched routing system
              </span>{' '}
              that is designed to handle the beefiest of full-stack routing
              requirements with ease. Start builds on top of Router's fully
              inferred type safety to also provide type-safe full-stack APIs
              that keep you in the fast lane.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center grid grid-cols-1 grid-rows-1">
            <TbServerBolt className="text-cyan-700 dark:text-cyan-500 text-6xl row-start-1 col-start-1" />
            <div className="opacity-50 row-start-1 col-start-1">
              <TbServerBolt
                className="text-cyan-700 dark:text-cyan-500 text-6xl animate-ping"
                style={{
                  animationDuration: '2s',
                  animationTimingFunction: 'ease-out',
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              SSR, Streaming and Server RPCs
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Who said rich and interactive applications can't have it all?
              TanStack Start includes powerful capabilities for{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-500">
                full-document SSR, streaming, server functions and RPCs
              </span>
              . No more choosing between server-side rendering and top-class
              client-side interactivity. Command the server as you see fit.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaYinYang
              className="text-cyan-700 dark:text-cyan-500 text-6xl motion-safe:animate-spin"
              style={{
                animationDuration: '10s',
                animationTimingFunction: 'ease-in-out',
              }}
            />
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              Client-Side First, 100% Server Capable
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              While other frameworks continue to compromise on the client-side
              application experience we've cultivated as a front-end community
              over the years, TanStack Start stays true to the{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-500">
                client-side first developer experience,
              </span>{' '}
              while providing a{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-500">
                full-featured server-side capable system
              </span>{' '}
              that won't make you compromise on user experience.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <PiRocketLaunchDuotone
              className="text-cyan-700 dark:text-cyan-500 text-6xl motion-safe:animate-bounce"
              style={{
                animationDuration: '2.5s',
                animationTimingFunction: 'ease-in-out',
              }}
            />
          </div>
          <div className="flex flex-col gap-4 text-center">
            <h3 className="uppercase text-xl font-black">
              Deploy Anywhere with Vinxi & Vite
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-6">
              With Vinxi and Vite under the hood, TanStack Start is designed to
              be{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-500">
                deployable anywhere JS can run
              </span>
              . Whether you're hosting on a traditional server, a serverless
              platform, or even a CDN, Start seamless builds, bundles and
              deploys your application with ease.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-8 px-4">
        <div className="font-black text-3xl mr-1 text-center">
          When can I use it?
        </div>
        <div className="max-w-full p-8 w-[800px] mx-auto leading-loose space-y-4 bg-white dark:bg-gray-700 rounded-xl shadow-xl shadow-black/10">
          <div>
            <strong>TanStack Start </strong> is currently in development and is
            almost ready for public use! We are working hard to bring you the
            best possible experience and will be releasing more details soon. In
            the meantime, you can follow along with the development process by
            watching the commits on this very website!
          </div>
          <div>
            Yes, you heard that right!{' '}
            <strong>
              TanStack.com is already being built and deployed using TanStack
              Start
            </strong>
            ! We are eating our own dog food and are excited to share the
            results with you soon!
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <a
            href={`https://github.com/tanstack/tanstack.com`}
            className={`flex items-center gap-2 py-2 px-4 bg-cyan-700 rounded text-white uppercase font-extrabold`}
          >
            <FaGithub /> View TanStack.com Source
          </a>
          <a
            href={`https://twitter.com/intent/post?text=${encodeURIComponent(
              `I'm excited for TanStack Start, new full-stack React framework coming soon from team @Tan_Stack!
              
Check it out at https://tanstack.com/start/`
            )}`}
            target="_blank"
            className={`flex items-center gap-2 py-2 px-4 bg-cyan-500 rounded text-white uppercase font-extrabold`}
            rel="noreferrer"
          >
            <FaTwitter /> Tweet about it!
          </a>{' '}
        </div>
      </div>

      {/* <div
        className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
      >
        <div className="flex-1 flex flex-col gap-8 items-center">
          <VscWand className="text-cyan-500 text-6xl" />
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Built on TanStack Router
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              Writing your data fetching logic by hand is over. Tell TanStack
              Query where to get your data and how fresh you need it to be and
              the rest is automatic. It handles{' '}
              <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                caching, background updates and stale data out of the box with
                zero-configuration
              </span>
              .
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaBolt className="text-sky-600 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Simple & Familiar
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              If you know how to work with promises or async/await, then you
              already know how to use TanStack Query. There's{' '}
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                no global state to manage, reducers, normalization systems or
                heavy configurations to understand
              </span>
              . Simply pass a function that resolves your data (or throws an
              error) and the rest is history.
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-8 items-center">
          <div className="text-center">
            <FaCogs className="text-blue-500 text-6xl" />
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="uppercase text-center text-xl font-black">
              Extensible
            </h3>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
              TanStack Query is configurable down to each observer instance of a
              query with knobs and options to fit every use-case. It comes wired
              up with{' '}
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                dedicated devtools, infinite-loading APIs, and first class
                mutation tools that make updating your data a breeze
              </span>
              . Don't worry though, everything is pre-configured for success!
            </p>
          </div>
        </div>
      </div> */}

      {/* <div className="px-4 sm:px-6 lg:px-8 mx-auto">
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            No dependencies. All the Features.
          </h3>
          <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
            With zero dependencies, TanStack Query is extremely lean given the
            dense feature set it provides. From weekend hobbies all the way to
            enterprise e-commerce systems (Yes, I'm lookin' at you Walmart! 😉),
            TanStack Query is the battle-hardened tool to help you succeed at
            the speed of your creativity.
          </p>
        </div>
        <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4  mx-auto">
          {[
            'Backend agnostic',
            'Dedicated Devtools',
            'Auto Caching',
            'Auto Refetching',
            'Window Focus Refetching',
            'Polling/Realtime Queries',
            'Parallel Queries',
            'Dependent Queries',
            'Mutations API',
            'Automatic Garbage Collection',
            'Paginated/Cursor Queries',
            'Load-More/Infinite Scroll Queries',
            'Scroll Recovery',
            'Request Cancellation',
            'Suspense Ready!',
            'Render-as-you-fetch',
            'Prefetching',
            'Variable-length Parallel Queries',
            'Offline Support',
            'SSR Support',
            'Data Selectors',
          ].map((d, i) => {
            return (
              <span key={i} className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500 " /> {d}
              </span>
            )
          })}
        </div>
      </div> */}

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
                  'Google',
                  'Walmart',
                  'Facebook',
                  'PayPal',
                  'Amazon',
                  'American Express',
                  'Microsoft',
                  'Target',
                  'Ebay',
                  'Autodesk',
                  'CarFAX',
                  'Docusign',
                  'HP',
                  'MLB',
                  'Volvo',
                  'Ocado',
                  'UPC.ch',
                  'EFI.com',
                  'ReactBricks',
                  'Nozzle.io',
                  'Uber',
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

      <div className="px-4 lg:max-w-screen-lg md:mx-auto mx-auto">
        <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
          Partners
        </h3>
        <div className="h-8" />
        <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2`}>
          {partners
            .filter((d) => d.libraries?.includes('router'))
            .map((partner) => {
              return (
                <a
                  key={partner.name}
                  href={partner.href}
                  target="_blank"
                  className="bg-white shadow-xl shadow-gray-500/20 rounded-lg dark:border border-gray-500/20 dark:bg-gray-800 dark:shadow-none group overflow-hidden grid"
                  rel="noreferrer"
                >
                  <div className="z-0 row-start-1 col-start-1 bg-white flex items-center justify-center group-hover:blur-sm transition-all duration-200">
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

      <div className="mx-auto max-w-[400px] flex flex-col gap-2 items-center">
        <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white max-w-[250px] mx-auto">
          <Carbon />
        </div>
        <span
          className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500
                dark:bg-opacity-20"
        >
          This ad helps us be happy about our invested time and not burn out and
          rage-quit OSS. Yay money! 😉
        </span>
      </div>

      {/* <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Less code, fewer edge cases.
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            Instead of writing reducers, caching logic, timers, retry logic,
            complex async/await scripting (I could keep going...), you literally
            write a tiny fraction of the code you normally would. You will be
            surprised at how little code you're writing or how much code you're
            deleting when you use TanStack Query. Try it out with one of the
            examples below!
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {(
              [
                { label: 'Angular', value: 'angular' },
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
                    ? 'bg-cyan-500'
                    : 'bg-gray-300 dark:bg-gray-700 hover:bg-cyan-300'
                }`}
                onClick={() => setFramework(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div> */}

      {/* {[''].includes(framework) ? (
        <div className="px-2">
          <div className="p-8 text-center text-lg w-full max-w-screen-lg mx-auto bg-black text-white rounded-xl">
            Looking for the <strong>@tanstack/{framework}-query</strong>{' '}
            example? We could use your help to build the{' '}
            <strong>@tanstack/{framework}-query</strong> adapter! Join the{' '}
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
            src={`https://stackblitz.com/github/${repo}/tree/${branch}/examples/${framework}/simple?embed=1&theme=${
              isDark ? 'dark' : 'light'
            }`}
            title={`tannerlinsley/${framework}-query: basic`}
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
      )} */}

      {/* <div className="flex flex-col gap-4 items-center">
        <div className="font-extrabold text-xl lg:text-2xl">
          Wow, you've come a long way!
        </div>
        <div className="italic font-sm opacity-70">
          Only one thing left to do...
        </div>
        <div>
          <Link
            to="./docs/"
            className={`inline-block py-2 px-4 bg-cyan-500 rounded text-white uppercase font-extrabold`}
          >
            Read the Docs!
          </Link>
        </div>
      </div> */}
      <Footer />
    </div>
  )
}
