import { Await, getRouteApi, Link, MatchRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import LandingPageGad from '~/components/LandingPageGad'
import OpenSourceStats from '~/components/OpenSourceStats'
import SponsorPack from '~/components/SponsorPack'
import { useMutation } from '~/hooks/useMutation'
import bytesImage from '~/images/bytes.svg'
import discordImage from '~/images/discord-logo-white.svg'
import splashDarkImg from '~/images/splash-dark.png'
import splashLightImg from '~/images/splash-light.png'
import { librariesByGroup, librariesGroupNamesMap, Library } from '~/libraries'
import { sample } from '~/utils/utils'
import { CgSpinner } from 'react-icons/cg'
import { twMerge } from 'tailwind-merge'
import { partners } from '../../utils/partners'

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

export const Route = createFileRoute({
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
  sample(gradients, randomNumber)

  return (
    <>
      {/* <img
        src={waves}
        className="-bottom-[50px] -left-[10px] z-0 fixed opacity-20"
      />
      <img
        src={toyPalmChair}
        className="-bottom-[50px] -right-[100px] z-0 fixed opacity-20"
      /> */}
      <div className="z-10 max-w-full space-y-24">
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-4 xl:flex-row xl:justify-center xl:pt-24">
            <img
              src={splashLightImg}
              className="w-[300px] pt-8 xl:w-[400px] xl:pt-0 2xl:w-[500px] dark:hidden"
              alt="TanStack Logo"
            />
            <img
              src={splashDarkImg}
              className="hidden w-[300px] pt-8 xl:w-[400px] xl:pt-0 2xl:w-[500px] dark:block"
              alt="TanStack Logo"
            />
            <div className="flex flex-col items-center gap-6 px-4 text-center xl:items-start xl:text-left">
              <div className="flex items-center gap-2 lg:gap-4">
                <h1
                  className={`inline-block text-5xl font-black md:text-6xl lg:text-8xl`}
                >
                  <span
                    className={`mb-2 inline-block pr-1.5 [letter-spacing:-.04em] text-black uppercase dark:text-white`}
                  >
                    TanStack
                  </span>
                </h1>
              </div>
              <h2 className="max-w-md text-2xl font-bold text-balance md:max-w-2xl md:text-4xl lg:max-w-2xl 2xl:text-5xl">
                High-quality open-source software for{' '}
                <span className="underline decoration-yellow-500 decoration-dashed decoration-3 underline-offset-2">
                  web developers.
                </span>
              </h2>
              <p className="text max-w-sm text-balance opacity-90 lg:max-w-2xl lg:text-xl">
                Headless, type-safe, & powerful utilities for Web Applications,
                Routing, State Management, Data Visualization, Datagrids/Tables,
                and more.
              </p>
            </div>
          </div>
          <div className="mx-auto w-fit px-4">
            <OpenSourceStats />
          </div>
        </div>
        <div className="px-4 md:mx-auto lg:max-w-screen-lg">
          <h3 className={`text-center text-4xl font-light`}>
            Open Source Libraries
          </h3>

          {Object.entries(librariesByGroup).map(
            ([groupName, groupLibraries]: [string, Library[]]) => (
              <div key={groupName} className="mt-8">
                <h4
                  className={`mb-6 text-center text-2xl font-medium capitalize`}
                >
                  {
                    librariesGroupNamesMap[
                      groupName as keyof typeof librariesGroupNamesMap
                    ]
                  }
                </h4>
                {/* Library Cards */}
                <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-2 md:grid-cols-3">
                  {groupLibraries.map((library, i: number) => {
                    return (
                      <Link
                        key={library.name}
                        to={library.to ?? '#'}
                        params
                        className={twMerge(
                          `rounded-xl border-transparent bg-white/90 p-6 shadow-md backdrop-blur-sm transition-all duration-300 dark:border-gray-800/50 dark:bg-black/40`,
                          'hover:shadow-lg',
                          'group relative overflow-hidden',
                          'min-h-60 hover:scale-105',
                          library.cardStyles,
                        )}
                        style={{
                          zIndex: i,
                        }}
                      >
                        {/* Background content that will blur on hover */}
                        <div className="relative z-0 flex h-full flex-col justify-between transition-[filter] duration-200 group-hover:blur-[0.5px]">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <MatchRoute
                                pending
                                to={library.to}
                                children={(isPending) => {
                                  return (
                                    <div
                                      className={twMerge(
                                        `flex items-center gap-2 text-[1.2rem] font-extrabold [letter-spacing:-.04em] uppercase`,
                                      )}
                                      style={{
                                        viewTransitionName: `library-name-${library.id}`,
                                      }}
                                    >
                                      <span className="flex items-center rounded-lg bg-current leading-none">
                                        <span className="p-1.5 px-2 text-[13px] leading-none font-black text-white uppercase dark:text-black">
                                          TanStack
                                        </span>
                                      </span>
                                      <span className="text-current">
                                        {library.name.replace('TanStack ', '')}
                                      </span>
                                    </div>
                                  )
                                }}
                              />
                            </div>
                            <div
                              className={`mt-3 text-sm font-semibold text-current italic`}
                            >
                              {library.tagline}
                            </div>
                          </div>

                          {/* Description preview with ellipsis */}
                          <div
                            className={`mt-3 line-clamp-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300`}
                          >
                            {library.description}
                          </div>
                        </div>

                        {/* Foreground content that appears on hover */}
                        <div className="absolute inset-0 z-30 flex h-full flex-col justify-between bg-white/95 p-6 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 dark:bg-black/95">
                          <div
                            className={`text-[12.95px] leading-relaxed text-gray-800 dark:text-gray-200`}
                          >
                            {library.description}
                          </div>
                          <div className="mt-1 text-center">
                            <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-gray-900 dark:bg-white/10 dark:text-white">
                              Click to learn more
                              <svg
                                className="h-4 w-4 transform transition-transform duration-200 group-hover:translate-x-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </span>
                          </div>
                        </div>
                        {/* Badge */}

                        {library.badge ? (
                          <div
                            className={twMerge(
                              `absolute top-0 right-0 z-20 group-hover:hidden`,
                            )}
                          >
                            <div
                              className={twMerge(
                                `h-[100px] w-[100px] translate-x-1/2 -translate-y-1/2 rounded-full`,
                                library.bgStyle,
                              )}
                            />
                            <span
                              className={twMerge(
                                'inline-block rotate-45 transform animate-pulse text-xs font-black text-white uppercase italic',
                                library.badge.length > 4
                                  ? 'absolute top-[16px] right-[-2px]'
                                  : 'absolute top-[14px] right-[5px]',
                              )}
                            >
                              {library.badge}
                            </span>
                          </div>
                        ) : null}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="px-4 md:mx-auto lg:max-w-screen-lg">
          <h3 className={`mb-6 text-center text-4xl font-light`}>Partners</h3>
          <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2`}>
            {partners.map((partner) => {
              return (
                <a
                  key={partner.name}
                  href={partner.href}
                  target="_blank"
                  className="group grid overflow-hidden rounded-lg border-gray-500/20 bg-white/80 shadow-xl shadow-gray-500/20 dark:border dark:bg-black/40 dark:shadow-none"
                  rel="noreferrer"
                >
                  <div className="z-0 col-start-1 row-start-1 flex items-center justify-center p-4 transition-all duration-200 group-hover:blur-md">
                    {partner.homepageImg}
                  </div>
                  <div className="z-10 col-start-1 row-start-1 flex max-w-full flex-col items-start justify-center gap-4 bg-white/70 p-4 text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-800/80">
                    {partner.content}
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        <div className={`mx-auto px-4 lg:max-w-screen-lg`}>
          <h3 className={`mb-6 text-center text-4xl font-light`}>Courses</h3>
          <div className={`mt-4 grid grid-cols-1 gap-4`}>
            {courses.map((course) => (
              <a
                key={course.name}
                href={course.href}
                className={`flex justify-between gap-2 rounded-lg border-2 border-transparent bg-white/90 p-4 shadow-xl shadow-green-700/10 transition-all hover:border-green-500 md:p-8 dark:bg-black/40 dark:shadow-green-500/30`}
                target="_blank"
                rel="noreferrer"
              >
                <div className={`col-span-2 md:col-span-5`}>
                  <div className={`text-2xl font-bold text-green-500`}>
                    {course.name}
                  </div>
                  <div className={`mt-2 text-sm`}>{course.description}</div>
                  <div
                    className={`mt-4 inline-block rounded bg-green-500 px-4 py-2 text-sm font-black text-white uppercase shadow`}
                  >
                    Check it out →
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className={`mx-auto px-4 lg:max-w-screen-lg`}>
          <h3 className={`text-center text-4xl font-light`}>OSS Sponsors</h3>
          <div className="h-6" />
          <div
            style={{
              aspectRatio: '1/1',
            }}
            className="mx-auto max-w-[1000px]"
          >
            <Await
              promise={sponsorsPromise}
              fallback={<CgSpinner className="mx-auto animate-spin text-2xl" />}
              children={(sponsors) => {
                return <SponsorPack sponsors={sponsors} />
              }}
            />
          </div>
          <div className={`h-8`} />
          <div className={`text-center`}>
            <div>
              <a
                href="https://github.com/sponsors/tannerlinsley"
                className={`inline-block rounded bg-green-500 p-4 font-black text-white uppercase`}
              >
                Become a Sponsor!
              </a>
            </div>
            <div className={`h-4`} />
            <p className={`mx-auto max-w-screen-sm text-gray-500 italic`}>
              Sponsors get special perks like{' '}
              <strong>
                private discord channels, priority issue requests, direct
                support and even course vouchers
              </strong>
              !
            </p>
          </div>
        </div>

        <LandingPageGad />

        <div className="mx-auto max-w-screen-lg px-4">
          <div
            className={`bg-discord relative grid items-center gap-6 overflow-hidden rounded-md p-4 text-white shadow-xl shadow-indigo-700/30 sm:grid-cols-3 sm:p-8`}
          >
            <div
              className={`absolute top-0 right-0 z-0 translate-x-1/3 -translate-y-1/3 transform opacity-10 sm:opacity-20`}
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
                The official TanStack community to ask questions, network and
                make new friends and get lightning fast news about what's coming
                next for TanStack!
              </p>
            </div>
            <div className={`flex items-center justify-center`}>
              <a
                href="https://discord.com/invite/WrRKjPJ"
                target="_blank"
                className={`text-discord z-10 mt-4 block w-full rounded bg-white px-4 py-2 text-center font-black uppercase shadow-lg`}
                rel="noreferrer"
              >
                Join TanStack Discord
              </a>
            </div>
          </div>
        </div>
        <div className="h-4" />
        <div className="relative mx-auto max-w-screen-lg px-4">
          <div className="rounded-md bg-white p-8 shadow-xl shadow-gray-900/10 md:p-14 dark:bg-black/40">
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

                  <h3 className={`mt-1 text-lg`}>
                    The Best JavaScript Newsletter
                  </h3>
                </div>
                <div className={`mt-4 grid grid-cols-3 gap-2`}>
                  <input
                    disabled={bytesSignupMutation.status === 'pending'}
                    className={`dark:(text-white bg-gray-700) col-span-2 w-full rounded bg-gray-200 p-3 text-sm text-black placeholder-gray-400 outline-none focus:outline-none`}
                    name="email_address"
                    placeholder="Your email address"
                    type="text"
                    required
                  />
                  <button
                    type="submit"
                    className={`rounded bg-[#ED203D] font-black text-white uppercase`}
                  >
                    <span>
                      {bytesSignupMutation.status === 'pending'
                        ? 'Loading ...'
                        : 'Subscribe'}
                    </span>
                  </button>
                </div>
                {bytesSignupMutation.error ? (
                  <p
                    className={`mt-2 text-sm font-semibold text-red-500 italic`}
                  >
                    Looks like something went wrong. Please try again.
                  </p>
                ) : (
                  <p className={`mt-2 text-sm font-semibold italic opacity-30`}>
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
    </>
  )
}
