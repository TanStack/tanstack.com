import type { MetaFunction } from 'remix'
import { Nav } from '~/components/Nav'
import { Carbon } from '~/components/Carbon'
import { ParentSize } from '@visx/responsive'
import { fromTheme, twMerge } from 'tailwind-merge'
import { twConfig } from '~/utils/twConfig'

const libraries = [
  {
    name: 'React Query',
    getStyles: () =>
      `bg-red-500 hover:bg-white hover:border-red-500 hover:bg-transparent hover:text-red-500 hover:dark:text-red-400`,
    href: 'https://react-query.tanstack.com',
    tagline: `Performant and powerful data synchronization for React`,
    description: `Fetch, cache and update data in your React and React Native applications all without touching any "global state".`,
  },
  {
    name: 'React Table',
    getStyles: () =>
      `bg-blue-500 hover:bg-white hover:border-blue-500 hover:bg-transparent hover:text-blue-600 hover:dark:text-blue-400`,
    href: 'https://react-table.tanstack.com',
    tagline: `Lightweight and extensible data tables for React`,
    description: `Build and design powerful datagrid experiences while retaining 100% control over markup and styles.`,
  },
  {
    name: 'React Charts',
    getStyles: () =>
      `bg-yellow-500 text-black hover:bg-white hover:border-yellow-500 hover:bg-transparent hover:dark:text-yellow-500`,
    href: 'https://react-charts.tanstack.com',
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
  },
  {
    name: 'React Location',
    getStyles: () =>
      `bg-green-500 hover:bg-white hover:border-green-700 hover:bg-transparent hover:text-green-700 hover:dark:text-green-400`,
    href: 'https://react-location.tanstack.com',
    tagline: `Enterprise routing for React applications`,
    description: `Powerful, enterprise-grade routing including first-class URL Search APIs, declarative/suspendable route loaders & code-splitting and more.`,
  },
  {
    name: 'React Virtual',
    getStyles: () =>
      `bg-purple-600 hover:bg-white hover:border-purple-700 hover:bg-transparent hover:text-purple-700 hover:dark:text-purple-400`,
    href: 'https://react-virtual.tanstack.com',
    tagline: `Auto-sizing, buttery smooth headless virtualization... with just one hook.`,
    description: `Oh, did we mention it supports vertical, horizontal, grid, fixed, variable, dynamic, smooth and infinite virtualization too?`,
  },
]

const courses = [
  {
    name: 'React Query Essentials (v2)',
    getStyles: () => `border-t-4 border-red-500 hover:border-green-500`,
    href: 'https://learn.tanstack.com',
    description: `The official and exclusive guide to mastering server-state in your applications, straight from the original creator and maintainer of the library.`,
    price: `$30 - $100`,
  },
]

const footerLinks = [
  { name: 'Twitter', href: 'https://twitter.com/tannerlinsley' },
  {
    name: 'Youtube',
    href: 'https://www.youtube.com/user/tannerlinsley',
  },
  { name: 'Github', href: 'https://github.com/tannerlinsley' },
  {
    name: 'Nozzle.io - Keyword Rank Tracker',
    href: 'https://nozzle.io',
  },
  {
    name: `Tanner's Blog`,
    href: 'https://tannerlinsley.com',
  },
]

export let meta: MetaFunction = () => {
  const title = 'Quality Software & Open Source Libraries for the Modern Web'
  const description = `TanStack is an incubator and collection of software, products, tools and courses for building professional and enterprise-grade front-end applciations for the web.`
  const imageHref = 'https://tanstack.com/favicon.png'
  return {
    title,
    description,
    keywords:
      'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software',
    'twitter:image': imageHref,
    'twitter:card': 'summary_large_image',
    'twitter:creator': '@tannerlinsley',
    'twitter:site': '@tannerlinsley',
    'twitter:title': 'TanStack',
    'twitter:description': description,
    'og:type': 'website',
    'og:title': title,
    'og:description': description,
    'og:image': imageHref,
  }
}

export default function Index() {
  return (
    <div>
      <section
        className={`text-white relative bg-red-500`}
        style={{
          backgroundImage: `
          radial-gradient(circle at 25% 140vw, transparent 85%, ${twConfig.theme.colors.yellow[500]}),
          radial-gradient(circle at 75% -100vw, transparent 85%, ${twConfig.theme.colors.blue[500]})
          `,
        }}
      >
        <div
          className={`absolute bg-cover bg-center inset-0`}
          style={{
            backgroundImage: `url(${require('../images/header-left-overlay.svg')})`,
          }}
        />
        <div className={`relative`}>
          <Nav />
          <div className={`text-center -mt-20 p-20`}>
            <div className={`w-max mx-auto grid gap-2 grid-cols-2`}>
              <img
                src={require('../images/javascript-logo-white.svg')}
                alt="Javascript Logo"
                width={70}
                height={70}
              />
              <img
                src={require('../images/react-logo-white.svg')}
                alt="React Logo"
                width={70}
                height={70}
              />
            </div>
            <p className={`text-4xl text-center italic font-semibold mt-6`}>
              Quality Software & Libraries
            </p>
            <p className={`text-2xl text-center font-extralight`}>
              for the Modern Web
            </p>
          </div>
        </div>
      </section>
      <div
        className={`relative max-w-screen-md mx-2 rounded-md p-8 -mt-10 bg-white shadow-lg md:p-14 md:mx-auto dark:bg-gray-800`}
      >
        <form
          action="https://app.convertkit.com/forms/1913546/subscriptions"
          method="post"
          data-sv-form="1913546"
          data-uid="7b33d93773"
          data-format="inline"
          data-version="5"
          data-options='{"settings":{"after_subscribe":{"action":"message","success_message":"Success! Please, check your email to confirm your subscription.","redirect_url":""},"modal":{"trigger":null,"scroll_percentage":null,"timer":null,"devices":null,"show_once_every":null},"recaptcha":{"enabled":false},"slide_in":{"display_in":null,"trigger":null,"scroll_percentage":null,"timer":null,"devices":null,"show_once_every":null}}}'
        >
          <ul
            className={`formkit-alert formkit-alert-error ` + `hidden`}
            data-element="errors"
            data-group="alert"
          />

          <div>
            <h3 className={`text-3xl`}>Don't miss a beat!</h3>
            <h3 className={`text-lg mt-1`}>Subscribe to our newsletter.</h3>
          </div>
          <div data-element="fields" className={`grid grid-cols-3 mt-4 gap-2`}>
            <input
              className={
                'formkit-input ' +
                `col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:text-white dark:bg-gray-700`
              }
              name="email_address"
              placeholder="Your email address"
              type="text"
              required
            />
            <button
              data-element="submit"
              className={'formkit-submit ' + `bg-blue-500 rounded text-white`}
            >
              <span>Subscribe</span>
            </button>
          </div>
          <p className={`text-sm opacity-30 font-semibold italic mt-2`}>
            We never spam, promise!
          </p>
        </form>
      </div>
      <div className={`mt-12 max-w-screen-md mx-4 md:mx-auto`}>
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2`}>
          <div>
            <h3 className={`text-4xl font-light`}>Products</h3>
            <div
              className={`mt-4 bg-white shadow-lg rounded-lg p-4 opacity-70 italic text-center text-gray-600 md:p-10 dark:bg-gray-800`}
            >
              Coming soon!
            </div>
          </div>
          <div>
            <h3 className={`text-4xl font-light`}>Partners</h3>
            <div className={`mt-4`}>
              <Carbon />
            </div>
          </div>
        </div>
      </div>
      <div className={`mt-12 max-w-screen-md mx-4 md:mx-auto`}>
        <h3 className={`text-4xl font-light`}>Open Source Libraries</h3>
        <div className={`mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2`}>
          {libraries.map((library) => (
            <a
              key={library.name}
              href={library.href}
              className={twMerge(
                `border-4 border-transparent rounded-lg shadow-lg p-4 md:p-10 text-white transition-all`,
                library.getStyles()
              )}
              target="_blank"
            >
              <div className={`text-3xl font-bold `}>{library.name}</div>
              <div className={`text-lg italic font-extralight mt-2`}>
                {library.tagline}
              </div>
              <div className={`text-sm mt-2`}>{library.description}</div>
            </a>
          ))}
        </div>
      </div>
      <div
        className={`mt-12 max-w-screen-md mx-4
            md:mx-auto`}
      >
        <h3 className={`text-4xl font-light`}>Courses</h3>
        <div className={`mt-4 grid grid-cols-1 gap-4`}>
          {courses.map((course) => (
            <a
              key={course.name}
              href={course.href}
              className={twMerge(
                `bg-white rounded-lg shadow-lg p-4 grid grid-cols-3 gap-6 transition-all ease-linear
                    md:p-8 md:grid-cols-6
                    dark:bg-gray-800`,
                course.getStyles()
              )}
              target="_blank"
            >
              <div
                className={`col-span-2
                    md:col-span-5`}
              >
                <div className={`text-2xl font-bold `}>{course.name}</div>
                <div className={`text-sm mt-2`}>{course.description}</div>
                <div
                  className={`inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded shadow`}
                >
                  Enroll →
                </div>
              </div>
              <div className={`flex-col text-center md:text-right`}>
                <div className={`text-center text-3xl font-bold`}>
                  {course.price}
                </div>
                <div className={`text-center text-sm opacity-70`}>
                  per license
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
      <div className={`mt-12 max-w-screen-md mx-4 md:mx-auto`}>
        <h3 className={`text-4xl font-light`}>OSS Sponsors</h3>
        <div className={`mt-4 overflow-hidden`}>
          <ParentSize>
            {({ width }) => {
              return (
                <iframe
                  src={
                    process.env.NODE_ENV === 'production'
                      ? 'https://tanstack.com/sponsors-embed'
                      : 'http://localhost:3001/sponsors-embed'
                  }
                  loading="lazy"
                  style={{
                    width: width,
                    height: width,
                    overflow: 'hidden',
                  }}
                />
              )
            }}
          </ParentSize>
        </div>
        <div className={`h-6`} />
        <div className={`text-center`}>
          <div>
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className={`inline-block p-4 text-lg bg-green-500 rounded text-white`}
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
      <div
        className={`
          mt-12 mx-4 max-w-screen-md rounded-md p-4 shadow-lg grid gap-6
          bg-discord text-white overflow-hidden relative
          sm:p-8 sm:mx-auto sm:grid-cols-3`}
      >
        <div
          className={`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:opacity-20`}
        >
          <img
            src={require('../images/discord-logo-white.svg')}
            width={300}
            height={300}
          />
        </div>
        <div className={`sm:col-span-2`}>
          <h3 className={`text-3xl`}>TanStack on Discord</h3>
          <p className={`mt-4`}>
            The official TanStack community to ask questions, network and make
            new friends and get lightning fast news about what's coming next for
            TanStack!
          </p>
        </div>
        <div className={`flex items-center justify-center`}>
          <a
            href="https://discord.com/invite/WrRKjPJ"
            target="_blank"
            rel="noreferrer"
            className={`block w-full mt-4 px-4 py-2 bg-white text-discord text-center text-lg rounded shadow-lg z-10`}
          >
            Join TanStack Discord
          </a>
        </div>
      </div>
      <div className={`h-20`} />
      <div className={`bg-gray-800 text-white shadow-lg`}>
        <div className={`max-w-screen-md mx-auto py-12 px-4`}>
          <div className={`grid gap-1 md:grid-cols-2`}>
            {footerLinks.map((link) => (
              <div key={link.href}>
                <a href={link.href} className={`hover:underline`}>
                  {link.name}
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className={`text-center opacity-20 text-sm`}>
          &copy; {new Date().getFullYear()} Tanner Linsley
        </div>
        <div className={`h-8`}></div>
      </div>
    </div>
  )
}
