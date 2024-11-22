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
import { useMutation } from '~/hooks/useMutation'
import { sample } from '~/utils/utils'
import { libraries } from '~/libraries'
import logoColor from '~/images/logo-color-600w.png'
import bytesImage from '~/images/bytes.svg'
// import toyPalmChair from '~/images/toy-palm-chair.png'
// import waves from '~/images/waves.png'
// import background from '~/images/background.jpg'
import { partners } from '../utils/partners'
import { FaBox, FaCube, FaDownload, FaStar, FaUsers } from 'react-icons/fa'

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
    <>
      {/* <img
        src={waves}
        className="-bottom-[50px] -left-[10px] z-0 fixed opacity-20"
      />
      <img
        src={toyPalmChair}
        className="-bottom-[50px] -right-[100px] z-0 fixed opacity-20"
      /> */}
      <div className="max-w-full z-10">
        <div className="flex flex-col items-center gap-6 text-center px-4 pt-12 lg:pt-24">
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
            md:text-4xl
            lg:text-5xl lg:max-w-2xl text-balance"
          >
            High-quality open-source software for{' '}
            <span className="underline decoration-dashed decoration-yellow-500 decoration-3 underline-offset-2">
              web developers.
            </span>
          </h2>
          <p
            className="text opacity-90 max-w-sm
            lg:text-xl lg:max-w-2xl text-balance"
          >
            Headless, type-safe, & powerful utilities for Web Applications,
            Routing, State Management, Data Visualization, Datagrids/Tables, and
            more.
          </p>
        </div>
        <div className="h-8" />
        <div className="p-8 w-fit mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8 items-center justify-center place-items-center bg-white/50 dark:bg-gray-700/30 dark:shadow-none rounded-xl shadow-xl">
          <div className="flex gap-4 items-center">
            <FaDownload className="text-2xl" />
            <div className="">
              <div className="text-2xl font-bold opacity-80">352,749,203</div>
              <div className="text-sm opacity-50 font-medium italic">
                NPM Downloads
              </div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <FaStar className="text-2xl" />
            <div className="">
              <div className="text-2xl font-bold opacity-80">91,478</div>
              <div className="text-sm opacity-50 font-medium italic">
                Stars on Github
              </div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <FaUsers className="text-2xl" />
            <div className="">
              <div className="text-2xl font-bold opacity-80">1,959</div>
              <div className="text-sm opacity-50 font-medium italic">
                Contributors on GitHub
              </div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <FaCube className="text-2xl" />
            <div className="">
              <div className="text-2xl font-bold opacity-80">1,126,523</div>
              <div className="text-sm opacity-50 font-medium italic">
                Dependents on GitHub
              </div>
            </div>
          </div>
        </div>
        <div className="h-24" />
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
          <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2`}>
            {partners.map((partner) => {
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
        <div className="h-20" />
        <div className={`lg:max-w-screen-lg px-4 mx-auto`}>
          <h3 className={`text-4xl font-light`}>Courses</h3>
          <div className={`mt-4 grid grid-cols-1 gap-4`}>
            {courses.map((course) => (
              <a
                key={course.name}
                href={course.href}
                className={`flex gap-2 justify-between border-2 border-transparent rounded-lg p-4 md:p-8
              transition-all bg-white/90 dark:bg-gray-800/90
              shadow-xl shadow-green-700/10 dark:shadow-green-500/30
              hover:border-green-500
              `}
                target="_blank"
                rel="noreferrer"
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
                private discord channels, priority issue requests, direct
                support and even course vouchers
              </strong>
              !
            </p>
          </div>
        </div>
        <div className="h-12" />
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
                The official TanStack community to ask questions, network and
                make new friends and get lightning fast news about what's coming
                next for TanStack!
              </p>
            </div>
            <div className={`flex items-center justify-center`}>
              <a
                href="https://discord.com/invite/WrRKjPJ"
                target="_blank"
                className={`block w-full mt-4 px-4 py-2 bg-white text-discord
                text-center rounded shadow-lg z-10 uppercase font-black`}
                rel="noreferrer"
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
                  <p
                    className={`text-sm text-red-500 font-semibold italic mt-2`}
                  >
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
    </>
  )
}
