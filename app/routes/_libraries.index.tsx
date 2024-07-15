import {
  Await,
  Link,
  MatchRoute,
  createFileRoute,
  getRouteApi,
} from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { twMerge } from 'tailwind-merge'
import { CgSpinner } from 'react-icons/cg'
import { Footer } from '~/components/Footer'
import SponsorPack from '~/components/SponsorPack'
import discordImage from '~/images/discord-logo-white.svg'
import agGridImage from '~/images/ag-grid.png'
import nozzleImage from '~/images/nozzle.png'
import bytesUidotdevImage from '~/images/bytes-uidotdev.png'
import { useMutation } from '~/hooks/useMutation'
import { sample } from '~/utils/utils'
import { libraries } from '~/libraries'
import logoColor from '~/images/logo-color-600w.png'
import bytesImage from '~/images/bytes.svg'
import vercelLightSvg from '~/images/vercel-light.svg'
import vercelDarkSvg from '~/images/vercel-dark.svg'
import convexWhiteSvg from '~/images/convex-white.svg'
import convexColorSvg from '~/images/convex-color.svg'

export const textColors = [
  `text-rose-500`,
  `text-yellow-500`,
  `text-teal-500`,
  `text-blue-500`,
]

export const gradients = [
  `from-rose-500 to-yellow-500`,
  `from-yellow-500 to-teal-500`,
  `from-teal-500 to-violet-500`,
  `from-blue-500 to-pink-500`,
]

const courses = [
  {
    name: 'The Official TanStack React Query Course',
    cardStyles: `border-t-4 border-red-500 hover:(border-green-500)`,
    href: 'https://query.gg/?s=tanstack',
    description: `Learn how to build enterprise quality apps with TanStack's React Query the easy way with our brand new course.`,
  },
]

export const Route = createFileRoute('/_libraries/')({
  loader: () => {
    return {
      randomNumber: Math.random(),
    }
  },
  component: Index,
})

async function bytesSignupServerFn({ email }: { email: string }) {
  'use server'

  return fetch(`https://bytes.dev/api/bytes-optin-cors`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      influencer: 'tanstack',
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

const librariesRouteApi = getRouteApi('/_libraries')

function Index() {
  const bytesSignupMutation = useMutation({
    fn: bytesSignupServerFn,
  })

  const { randomNumber } = Route.useLoaderData()
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const gradient = sample(gradients, randomNumber)

  return (
    <div className="max-w-full">
      <div className="flex flex-col items-center gap-6 text-center px-4 py-12 lg:py-24">
        <div className="flex gap-2 lg:gap-4 items-center">
          <img
            src={logoColor}
            alt="TanStack Logo"
            className="w-[40px] md:w-[60px] lg:w-[100px]"
          />
          <h1
            className={`inline-block
            font-black text-5xl
            md:text-6xl
            lg:text-8xl`}
          >
            <span
              className={`
            inline-block text-transparent bg-clip-text bg-gradient-to-r ${gradient}
            underline decoration-4 md:decoration-8 underline-offset-[.5rem] md:underline-offset-[1rem] decoration-gray-200 dark:decoration-gray-800
            mb-2 uppercase [letter-spacing:-.05em]
            `}
            >
              TanStack
            </span>
          </h1>
        </div>
        <h2
          className="font-bold text-2xl max-w-md
            md:text-3xl
            lg:text-5xl lg:max-w-2xl"
        >
          High-quality open-source software for{' '}
          <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
            web developers.
          </span>
        </h2>
        <p
          className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl"
        >
          Headless, type-safe, & powerful utilities for Web Applications,
          Routing, State Management, Data Visualization, Datagrids/Tables, and
          more.
        </p>
      </div>
      <div className="h-8" />
      <div className="px-4 lg:max-w-screen-lg md:mx-auto">
        <h3 className={`text-4xl font-light`}>Open Source Libraries</h3>
        <div
          className={`mt-4 grid grid-cols-1 gap-8
            sm:grid-cols-2 sm:gap-4
            lg:grid-cols-3`}
        >
          {libraries.map((library, i) => {
            return (
              <Link
                key={library.name}
                to={library.to ?? '#'}
                params
                className={twMerge(
                  `border-4 border-transparent rounded-lg shadow-lg p-4 md:p-8 text-white transition-all bg-white dark:bg-gray-900 dark:border dark:border-gray-800`,
                  library.cardStyles
                )}
                style={{
                  zIndex: i,
                }}
              >
                <div className="flex gap-2 justify-between items-center">
                  <MatchRoute
                    pending
                    to={library.to}
                    children={(isPending) => {
                      if (isPending) {
                        console.log('pending', library.name)
                      }
                      return (
                        <div
                          className={twMerge(
                            `text-2xl font-extrabold`
                            // isPending && `[view-transition-name:library-name]`
                          )}
                          style={{
                            viewTransitionName: `library-name-${library.id}`,
                          }}
                        >
                          {library.name}
                        </div>
                      )
                    }}
                  />
                  {library.badge ? (
                    <div
                      className={twMerge(
                        `uppercase text-white bg-yellow-500 rounded-full px-2 py-1 text-xs font-black animate-pulse`,
                        library.bgStyle
                      )}
                    >
                      {library.badge}
                    </div>
                  ) : null}
                </div>
                <div className={`text-lg italic font-light mt-2`}>
                  {library.tagline}
                </div>
                <div className={`text-sm mt-2 text-black dark:text-white`}>
                  {library.description}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
      <div className="h-12" />
      <div className={`px-4 lg:max-w-screen-lg md:mx-auto`}>
        <h3 className={`text-4xl font-light mb-4`}>Partners</h3>
        <div className={`grid grid-cols-1 gap-12 sm:grid-cols-2`}>
          {(
            [
              {
                name: 'Vercel',
                img: (
                  <a
                    href="https://vercel.com?utm_source=tanstack"
                    target="_blank"
                    className="dark:bg-black w-full h-full flex items-center justify-center px-4 py-12"
                  >
                    <img
                      src={vercelLightSvg}
                      alt="Vercel"
                      className="w-[220px] max-w-full dark:hidden"
                    />
                    <img
                      src={vercelDarkSvg}
                      alt="Vercel"
                      className="w-[220px] max-w-full hidden dark:block"
                    />
                  </a>
                ),
                content: (
                  <>
                    <div>
                      TanStack Router/Start and Vercel are a match made in
                      heaven. Vercel's{' '}
                      <strong>
                        cutting-edge deployment and serverless capabilities
                      </strong>{' '}
                      continue to deliver on the TanStack promise for apps to be{' '}
                      <strong>high-performant and scalable</strong>. We're
                      working closely with Vercel to not only ensure a flawless
                      deployment experience, but also push the boundaries of
                      what's possible with TanStack on the web.
                    </div>
                    <a
                      href="https://vercel.com?utm_source=tanstack"
                      target="_blank"
                      className="text-blue-500 uppercase font-black text-sm"
                    >
                      Learn More
                    </a>
                  </>
                ),
              },
              {
                name: 'AG Grid',
                img: (
                  <a
                    href="https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable"
                    target="_blank"
                    className="px-8 py-6"
                  >
                    <img
                      src={agGridImage}
                      alt="Enterprise Data Grid"
                      className="w-[270px] max-w-full"
                      width="270"
                      height="95"
                    />
                  </a>
                ),
                content: (
                  <>
                    <div>
                      TanStack Table and AG Grid are respectfully the{' '}
                      <strong>best table/datagrid libraries around</strong>, so
                      we've teamed up to ensure the highest quality
                      table/datagrid options are available for the entire JS/TS
                      ecosystem and every use-case imaginable for UI/UX
                      developers. If it's a table/datagrid, we've got you
                      covered.
                    </div>
                    <Link
                      to="/blog/$"
                      params={{
                        _splat: 'ag-grid-partnership',
                      }}
                      className="text-blue-500 uppercase font-black text-sm"
                    >
                      Learn More
                    </Link>
                  </>
                ),
              },
              {
                name: 'Convex',
                img: (
                  <a
                    href="https://convex.dev?utm_source=tanstack"
                    target="_blank"
                    className="dark:bg-black w-full h-full flex items-center justify-center px-4 py-6"
                  >
                    <img
                      src={convexColorSvg}
                      alt="Convex"
                      className="w-[300px] max-w-full dark:hidden"
                    />
                    <img
                      src={convexWhiteSvg}
                      alt="Convex"
                      className="w-[300px] max-w-full hidden dark:block"
                    />
                  </a>
                ),
                content: (
                  <>
                    <div>
                      Convex has teamed up with TanStack to not only deliver a{' '}
                      <strong>
                        first-class end-to-end type-safe experience
                      </strong>{' '}
                      to TanStack developers, but to also ensure TanStack is
                      ready for the real-time database arena. Convex's
                      all-in-one platform delivers end-to-end type-safety via a{' '}
                      <strong>
                        revolutionary relational, real-time database
                      </strong>{' '}
                      and together, we're elevating what's possible with
                      real-time React applications.
                    </div>
                    <a
                      href="https://convex.dev?utm_source=tanstack"
                      target="_blank"
                      className="text-blue-500 uppercase font-black text-sm"
                    >
                      Learn More
                    </a>
                  </>
                ),
              },
              {
                name: 'UI.dev',
                img: (
                  <a
                    href="https://bytes.dev?utm_source-tanstack&utm_campaign=tanstack"
                    target="_blank"
                    className="py-6"
                  >
                    <img
                      src={bytesUidotdevImage}
                      alt="Bytes Logo"
                      className="w-[350px] max-w-full"
                      width="250"
                      height="87"
                    />
                  </a>
                ),
                content: (
                  <>
                    <div>
                      TanStack's priority is to make its users productive,
                      efficient and knowledgeable about web dev. To help us on
                      this quest, we've partnered with{' '}
                      <a
                        target="_blank"
                        className="text-blue-500 underline"
                        href="https://ui.dev/?utm_source=tanstack&utm_campaign=tanstack"
                      >
                        ui.dev
                      </a>{' '}
                      to <strong>provide best-in-class education</strong> about
                      TanStack products. It doesn't stop at TanStack though,
                      with their sister product{' '}
                      <a
                        target="_blank"
                        className="text-blue-500 underline"
                        href="https://bytes.dev/?utm_source=tanstack&utm_campaign=tanstack"
                      >
                        Bytes.dev
                      </a>{' '}
                      as our official newsletter partner, you'll be able to{' '}
                      <strong>
                        stay up to date with the latest and greatest
                      </strong>{' '}
                      in the web dev world regardless.
                    </div>
                    <a
                      href="https://bytes.dev/?utm_source=tanstack&utm_campaign=tanstack"
                      target="_blank"
                      className="text-blue-500 uppercase font-black text-sm"
                    >
                      Learn More
                    </a>
                  </>
                ),
              },
              {
                name: 'Nozzle.io',
                img: (
                  <a
                    href="https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack"
                    target="_blank"
                    className="py-6"
                  >
                    <img
                      src={nozzleImage}
                      alt="SEO keyword rank tracker"
                      className="w-[230px] max-w-full my-2"
                      width="230"
                      height="80"
                    />
                  </a>
                ),
                content: (
                  <>
                    <div>
                      Since its founding, Nozzle's SEO platform was the original
                      home for almost all TanStack libraries. They were used to
                      build the{' '}
                      <strong>
                        most technically advanced search engine monitoring
                        platform
                      </strong>{' '}
                      of its kind. Its enterprise rank tracking and keyword
                      research tools continue to set a new bar for quality and
                      scale. Nozzle continues to prove the value of the full
                      gamut of TanStack tools on the front-end with unmatched
                      UI/UX.
                    </div>
                    <a
                      href="https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack"
                      target="_blank"
                      className="text-blue-500 uppercase font-black text-sm"
                    >
                      Learn More
                    </a>
                  </>
                ),
              },
            ] as const
          ).map((partner) => {
            return (
              <div
                key={partner.name}
                className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden dark:border border-gray-500/20
                        dark:bg-gray-800 dark:shadow-none"
              >
                <div className="flex-1 bg-white flex items-center justify-center">
                  {partner.img}
                </div>
                <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
                  {partner.content}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="h-20" />
      <div className={`lg:max-w-[400px] px-4 mx-auto`}>
        <div className="flex flex-col gap-4">
          <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white max-w-[250px] mx-auto">
            <Carbon />
          </div>
          <span
            className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500
                dark:bg-opacity-20 self-center"
          >
            This ad helps us be happy about our invested time and not burn out
            and rage-quit OSS. Yay money! 😉
          </span>
        </div>
      </div>
      <div className="h-12" />
      <div className={`lg:max-w-screen-lg px-4 mx-auto`}>
        <h3 className={`text-4xl font-light`}>Courses</h3>
        <div className={`mt-4 grid grid-cols-1 gap-4`}>
          {courses.map((course) => (
            <a
              key={course.name}
              href={course.href}
              className={`flex gap-2 justify-between border-2 border-transparent rounded-lg p-4 md:p-8
              transition-all bg-white dark:bg-gray-800
              shadow-xl shadow-green-700/10 dark:shadow-green-500/30
              hover:border-green-500
              `}
              target="_blank"
            >
              <div
                className={`col-span-2
                    md:col-span-5`}
              >
                <div className={`text-2xl font-bold text-green-500`}>
                  {course.name}
                </div>
                <div className={`text-sm mt-2`}>{course.description}</div>
                <div
                  className={`inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded shadow uppercase font-black text-sm`}
                >
                  Check it out →
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
      <div className="h-12" />
      <div className={`lg:max-w-screen-lg px-4 mx-auto`}>
        <h3 className={`text-4xl font-light`}>OSS Sponsors</h3>
        <div className="h-4" />
        <div
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
        <div className={`h-6`} />
        <div className={`text-center`}>
          <div>
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className={`inline-block p-4 bg-green-500 rounded text-white uppercase font-black`}
            >
              Become a Sponsor!
            </a>
          </div>
          <div className={`h-4`} />
          <p className={`italic mx-auto max-w-screen-sm text-gray-500`}>
            Sponsors get special perks like{' '}
            <strong>
              private discord channels, priority issue requests, direct support
              and even course vouchers
            </strong>
            !
          </p>
        </div>
      </div>
      <div className="h-12" />
      <div className="px-4 mx-auto max-w-screen-lg">
        <div
          className={`
          rounded-md p-4 grid gap-6
          bg-discord text-white overflow-hidden relative
          shadow-xl shadow-indigo-700/30
          sm:p-8 sm:grid-cols-3`}
        >
          <div
            className={`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:opacity-20`}
          >
            <img
              src={discordImage}
              alt="Discord Logo"
              width={300}
              height={300}
            />
          </div>
          <div className={`sm:col-span-2`}>
            <h3 className={`text-3xl`}>TanStack on Discord</h3>
            <p className={`mt-4`}>
              The official TanStack community to ask questions, network and make
              new friends and get lightning fast news about what's coming next
              for TanStack!
            </p>
          </div>
          <div className={`flex items-center justify-center`}>
            <a
              href="https://discord.com/invite/WrRKjPJ"
              target="_blank"
              className={`block w-full mt-4 px-4 py-2 bg-white text-discord
                text-center rounded shadow-lg z-10 uppercase font-black`}
            >
              Join TanStack Discord
            </a>
          </div>
        </div>
      </div>
      <div className="h-4" />
      <div className="px-4 mx-auto max-w-screen-lg relative">
        <div className="rounded-md p-8 bg-white shadow-xl shadow-gray-900/10 md:p-14 dark:bg-gray-800">
          {!bytesSignupMutation.submittedAt ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)

                bytesSignupMutation.mutate({
                  email: formData.get('email_address')?.toString() || '',
                })
              }}
            >
              <div>
                <div className={`relative inline-block`}>
                  <h3 className={`text-3xl`}>Subscribe to Bytes</h3>
                  <figure className={`absolute top-0 right-[-48px]`}>
                    <img
                      src={bytesImage}
                      alt="Bytes Logo"
                      width={40}
                      height={40}
                    />
                  </figure>
                </div>

                <h3 className={`text-lg mt-1`}>
                  The Best JavaScript Newsletter
                </h3>
              </div>
              <div className={`grid grid-cols-3 mt-4 gap-2`}>
                <input
                  disabled={bytesSignupMutation.status === 'pending'}
                  className={`col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:(text-white bg-gray-700)`}
                  name="email_address"
                  placeholder="Your email address"
                  type="text"
                  required
                />
                <button
                  type="submit"
                  className={`bg-[#ED203D] text-white rounded uppercase font-black`}
                >
                  <span>
                    {bytesSignupMutation.status === 'pending'
                      ? 'Loading ...'
                      : 'Subscribe'}
                  </span>
                </button>
              </div>
              {bytesSignupMutation.error ? (
                <p className={`text-sm text-red-500 font-semibold italic mt-2`}>
                  Looks like something went wrong. Please try again.
                </p>
              ) : (
                <p className={`text-sm opacity-30 font-semibold italic mt-2`}>
                  Join over 100,000 devs
                </p>
              )}
            </form>
          ) : (
            <p>🎉 Thank you! Please confirm your email</p>
          )}
        </div>
      </div>
      <div className={`h-20`} />
      <Footer />
    </div>
  )
}
