import { Await, Link, createFileRoute, defer } from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { twMerge } from 'tailwind-merge'
import { FaDiscord, FaGithub, FaTshirt } from 'react-icons/fa'
import { CgMusicSpeaker, CgSpinner } from 'react-icons/cg'
import { Footer } from '~/components/Footer'
import SponsorPack from '~/components/SponsorPack'
import { LogoColor } from '~/components/LogoColor'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import discordImage from '~/images/discord-logo-white.svg'
import agGridImage from '~/images/ag-grid.png'
import nozzleImage from '~/images/nozzle.png'
import bytesImage from '~/images/bytes.svg'
import bytesUidotdevImage from '~/images/bytes-uidotdev.png'
import { useMutation } from '~/hooks/useMutation'
import { sample } from '~/utils/utils'
import { projects } from '~/projects'

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

export const Route = createFileRoute('/')({
  loader: () => {
    return {
      randomNumber: Math.random(),
      sponsorsPromise: defer(getSponsorsForSponsorPack()),
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

function Index() {
  const bytesSignupMutation = useMutation({
    fn: bytesSignupServerFn,
  })

  const { sponsorsPromise, randomNumber } = Route.useLoaderData()
  const gradient = sample(gradients, randomNumber)
  const textColor = sample(textColors, randomNumber)

  return (
    <>
      <div
        className="flex flex-wrap py-2 px-4 items-center justify-center text-sm
          md:text-base md:justify-end"
      >
        {[
          {
            label: (
              <div className="flex items-center gap-1">
                <FaTshirt
                  className={twMerge('text-lg animate-bounce', textColor)}
                />
                Merch
              </div>
            ),
            to: 'https://cottonbureau.com/people/tanstack',
          },
          {
            label: (
              <div className="flex items-center gap-1">
                <CgMusicSpeaker className="text-lg" /> Blog
              </div>
            ),
            to: '/blog',
          },
          {
            label: (
              <div className="flex items-center gap-1">
                <FaGithub className="text-lg" /> GitHub
              </div>
            ),
            to: 'https://github.com/tanstack',
          },
          {
            label: (
              <div className="flex items-center gap-1">
                <FaDiscord className="text-lg" /> Discord
              </div>
            ),
            to: 'https://tlinz.com/discord',
          },
        ]?.map((item, i) => {
          const label = (
            <div className="p-2 opacity-90 hover:opacity-100">{item.label}</div>
          )

          return (
            <div key={i} className="hover:underline">
              {item.to.startsWith('http') ? (
                <a href={item.to} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ) : (
                <Link to={item.to} params>
                  {label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-6 text-center px-4 py-12 lg:py-24">
        <div className="flex gap-2 lg:gap-4 items-center">
          <LogoColor className="w-[40px] md:w-[60px] lg:w-[100px]" />
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
          Headless, type-safe, & powerful utilities for State Management,
          Routing, Data Visualization, Charts, Tables, and more.
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
          {projects.map((project, i) => {
            return (
              <Link
                key={project.name}
                to={project.to ?? '#'}
                params
                className={twMerge(
                  `border-4 border-transparent rounded-lg shadow-lg p-4 md:p-8 text-white transition-all bg-white dark:bg-gray-900 dark:border dark:border-gray-800`,
                  project.cardStyles
                )}
                style={{
                  zIndex: i,
                }}
              >
                <div className="flex gap-2 justify-between items-center">
                  <div className={`text-2xl font-extrabold `}>
                    {project.name}
                  </div>
                  {project.badge ? (
                    <div
                      className={twMerge(
                        `uppercase text-white bg-yellow-500 rounded-full px-2 py-1 text-xs font-black animate-pulse`,
                        project.bgStyle
                      )}
                    >
                      {project.badge}
                    </div>
                  ) : null}
                </div>
                <div className={`text-lg italic font-light mt-2`}>
                  {project.tagline}
                </div>
                <div className={`text-sm mt-2 text-black dark:text-white`}>
                  {project.description}
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
          <div
            className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
          >
            <div className="flex-1 bg-white flex items-center justify-center p-2">
              <a
                href="https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable"
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={agGridImage}
                  alt="Enterprise Data Grid"
                  className="w-[250px] max-w-full"
                  width="250"
                  height="87"
                />
              </a>
            </div>
            <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
              <div>
                TanStack Table and AG Grid are respectfully the{' '}
                <strong>best table/datagrid libraries around</strong>. Instead
                of competing, we're working together to ensure the highest
                quality table/datagrid options are available for the entire
                JS/TS ecosystem and every use-case imaginable for UI/UX
                developers.
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
            </div>
          </div>
          <div
            className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
          >
            <div className="flex-1 bg-white flex items-center justify-center p-2">
              <a href="https://bytes.dev" target="_blank" rel="noreferrer">
                <img
                  src={bytesUidotdevImage}
                  alt="Bytes Logo"
                  className="w-full max-w-[400px]"
                  width="250"
                  height="87"
                />
              </a>
            </div>
            <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
              <div>
                TanStack's priority is to make its users productive, efficient
                and knowledgeable about web dev. To help us on this quest, we've
                partnered with{' '}
                <a
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 underline"
                  href="https://ui.dev/?utm_source=tanstack&utm_campaign=tanstack"
                >
                  ui.dev
                </a>{' '}
                to <strong>provide best-in-class education</strong> about
                TanStack products. It doesn't stop at TanStack though, with
                their sister product{' '}
                <a
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 underline"
                  href="https://bytes.dev/?utm_source=tanstack&utm_campaign=tanstack"
                >
                  Bytes.dev
                </a>{' '}
                as our official newsletter partner, you'll be able to{' '}
                <strong>stay up to date with the latest and greatest</strong> in
                the web dev world regardless.
              </div>
              <a
                href="https://bytes.dev/?utm_source=tanstack&utm_campaign=tanstack"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 uppercase font-black text-sm"
              >
                Learn More
              </a>
            </div>
          </div>
          <div
            className="bg-white shadow-xl shadow-gray-500/20 rounded-lg flex flex-col
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
          >
            <div className="flex-1 bg-white flex items-center justify-center p-2">
              <a
                href="https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack"
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={nozzleImage}
                  alt="SEO keyword rank tracker"
                  className="w-[230px] max-w-full my-2"
                  width="230"
                  height="80"
                />
              </a>
            </div>
            <div className="flex-1 p-4 text-sm flex flex-col gap-4 items-start">
              <div>
                Since its founding, Nozzle's SEO platform has used TanStack
                libraries to build one of the{' '}
                <strong>
                  most technically advanced search engine monitoring platforms
                </strong>
                , its enterprise rank tracking and keyword research tools are
                setting a new bar for quality and scale. Nozzle uses the full
                gamut of TanStack tools on the front-end to deliver users with
                unmatched UI/UX.
              </div>
              <a
                href="https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 uppercase font-black text-sm"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="h-20" />
      <div className={`lg:max-w-[400px] px-4 mx-auto`}>
        <div className="flex flex-col gap-4">
          <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white">
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
            <img src={discordImage} width={300} height={300} />
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
              rel="noreferrer"
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
    </>
  )
}
