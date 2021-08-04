import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import tw, { theme } from 'twin.macro'

import Nav from '../components/Nav'
import CarbonAds from '../components/CarbonAds'
import { ParentSize } from '@visx/responsive'

const libraries = [
  {
    name: 'React Query',
    styles: tw`bg-red-500 hover:(bg-white border-red-500 bg-transparent text-red-500 dark:text-red-400)`,
    href: 'https://react-query.tanstack.com',
    tagline: `Performant and powerful data synchronization for React`,
    description: `Fetch, cache and update data in your React and React Native applications all without touching any "global state".`,
  },
  {
    name: 'React Table',
    styles: tw`bg-blue-700 hover:(bg-white border-blue-500 bg-transparent text-blue-600 dark:text-blue-400)`,
    href: 'https://react-table.tanstack.com',
    tagline: `Lightweight and extensible data tables for React`,
    description: `Build and design powerful datagrid experiences while retaining 100% control over markup and styles.`,
  },
  {
    name: 'React Charts',
    styles: tw`bg-yellow-500 text-black hover:(bg-white border-yellow-500 bg-transparent dark:text-yellow-500)`,
    href: 'https://react-charts.tanstack.com',
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
  },
  {
    name: 'React Virtual',
    styles: tw`bg-orange-700 hover:(bg-white border-orange-500 bg-transparent text-orange-600 dark:text-orange-400)`,
    href: 'https://react-virtual.tanstack.com',
    tagline: `Auto-sizing, buttery smooth headless virtualization... with just one hook.`,
    description: `Oh, did we mention it supports vertical, horizontal, grid, fixed, variable, dynamic, smooth and infinite virtualization too?`,
  },
]

const courses = [
  {
    name: 'React Query Essentials (v2)',
    styles: tw`border-t-4 border-red-500 hover:(border-green-500)`,
    href: 'https://learn.tanstack.com',
    description: `The official and exclusive guide to mastering server-state in your applications, straight from the original creator and maintainer of the library.`,
    price: 150,
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

const Anchor = React.forwardRef((props, ref) => {
  return <a ref={ref} {...props} />
})

Anchor.displayName = 'Anchor'

export default function Home() {
  return (
    <div>
      <section
        tw="text-white relative bg-red-500"
        style={{
          backgroundImage: `
          radial-gradient(circle at 25% 140vw, transparent 85%, ${theme`colors.yellow.500`}),
          radial-gradient(circle at 75% -100vw, transparent 85%, ${theme`colors.blue.500`})
          `,
        }}
      >
        <div
          tw="absolute bg-cover bg-center inset-0"
          style={{
            backgroundImage: 'url(/img/header-left-overlay.svg)',
          }}
        />
        <div tw="relative">
          <Nav />
          <div tw="text-center mt--20 p-20">
            <div tw="w-max mx-auto grid gap-2 grid-cols-2">
              <Image
                src="/img/javascript-logo-white.svg"
                alt="Javascript Logo"
                width={70}
                height={70}
              />
              <Image
                src="/img/react-logo-white.svg"
                alt="React Logo"
                width={70}
                height={70}
              />
            </div>
            <p tw="text-4xl text-center italic font-semibold mt-6">
              Quality Software & Libraries
            </p>
            <p tw="text-2xl text-center font-extralight">for the Modern Web</p>
          </div>
        </div>
      </section>
      <div tw="relative max-w-screen-md mx-2 rounded-md p-8 mt--10 bg-white shadow-lg md:(p-14 mx-auto) dark:(bg-gray-800)">
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
            className="formkit-alert formkit-alert-error hidden"
            data-element="errors"
            data-group="alert"
          />

          <div>
            <h3 tw="text-3xl">Don't miss a beat!</h3>
            <h3 tw="text-lg mt-1">Subscribe to our newsletter.</h3>
          </div>
          <div data-element="fields" tw="grid grid-cols-3 mt-4 gap-2">
            <input
              className="formkit-input"
              tw="col-span-2 p-3 placeholder-gray-400 text-gray-700 bg-gray-200 rounded text-sm outline-none focus:outline-none w-full text-black dark:(text-white bg-gray-700)"
              name="email_address"
              placeholder="Your email address"
              type="text"
              required=""
            />
            <button
              data-element="submit"
              className="formkit-submit"
              tw="bg-blue-500 rounded text-white"
            >
              <span>Subscribe</span>
            </button>
          </div>
          <p tw="text-sm opacity-30 font-semibold italic mt-2">
            We never spam, promise!
          </p>
        </form>
      </div>
      {/* <div tw="relative max-w-screen-md mx-2 rounded-md p-8 mt--10 bg-white shadow-lg md:(p-14 mx-auto) dark:(bg-gray-800)">
        <h1 tw="text-2xl font-bold">Blog</h1>
        <div>
          {[1, 2, 3].map((d) => (
            <div key={d} tw="mt-10 text-lg">
              <div tw="font-bold">Hello</div>
              <div tw="italic mt-2">Preview</div>
              <div tw="mt-2 text-blue-500 dark:(text-red-500)">
                <Link href="/">Read →</Link>
              </div>
            </div>
          ))}
        </div>
      </div> */}
      <div tw="mt-12 max-w-screen-md mx-4 md:(mx-auto)">
        <div tw="grid grid-cols-1 gap-4 sm:(grid-cols-2)">
          <div>
            <h3 tw="text-4xl font-light">Products</h3>
            <div tw="mt-4 bg-white shadow-lg rounded-lg p-4 opacity-70 italic text-center text-gray-600 md:(p-10) dark:(bg-gray-800)">
              Coming soon!
            </div>
          </div>
          <div>
            <h3 tw="text-4xl font-light">Partners</h3>
            <div tw="mt-4">
              <CarbonAds />
            </div>
          </div>
        </div>
      </div>
      <div tw="mt-12 max-w-screen-md mx-4 md:(mx-auto)">
        <h3 tw="text-4xl font-light">Open Source Libraries</h3>
        <div tw="mt-4 grid grid-cols-1 gap-4 sm:(grid-cols-2)">
          {libraries.map((library) => (
            <Link key={library.name} href={library.href}>
              <Anchor
                href={library.href}
                css={[
                  tw`border-4 border-transparent rounded-lg shadow-lg p-4 md:(p-10) text-white transition-all`,
                  library.styles,
                ]}
              >
                <div tw="text-3xl font-bold ">{library.name}</div>
                <div tw="text-lg italic font-extralight mt-2">
                  {library.tagline}
                </div>
                <div tw="text-sm mt-2">{library.description}</div>
              </Anchor>
            </Link>
          ))}
        </div>
      </div>
      <div
        tw="mt-12 max-w-screen-md mx-4
            md:(mx-auto)"
      >
        <h3 tw="text-4xl font-light">Courses</h3>
        <div tw="mt-4 grid grid-cols-1 gap-4">
          {courses.map((course) => (
            <Link key={course.name} href={course.href}>
              <Anchor
                href={course.href}
                css={[
                  tw`bg-white rounded-lg shadow-lg p-4 grid grid-cols-3 gap-6 transition-all ease-linear
                    md:(p-8 grid-cols-6)
                    dark:(bg-gray-800)`,
                  course.styles,
                ]}
              >
                <div
                  tw="col-span-2
                    md:(col-span-5)"
                >
                  <div tw="text-2xl font-bold ">{course.name}</div>
                  <div tw="text-sm mt-2">{course.description}</div>
                  <div tw="inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded shadow">
                    Enroll →
                  </div>
                </div>
                <div
                  tw="flex-col text-center
                      md:(text-right)"
                >
                  <div tw="text-center text-3xl font-bold">${course.price}</div>
                  <div tw="text-center text-sm opacity-70">per license</div>
                </div>
              </Anchor>
            </Link>
          ))}
        </div>
      </div>
      <div
        tw="mt-12 max-w-screen-md mx-4
            md:(mx-auto)"
      >
        <h3 tw="text-4xl font-light">OSS Sponsors</h3>
        <div tw="mt-4 overflow-hidden">
          <ParentSize>
            {({ width }) => {
              return (
                <iframe
                  src={
                    process.env.NODE_ENV === 'production'
                      ? 'https://tanstack.com/sponsors-embed'
                      : 'http://localhost:3000/sponsors-embed'
                  }
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
        <div tw="h-6" />
        <div tw="text-center">
          <div>
            <a
              href="https://github.com/sponsors/tannerlinsley"
              tw="inline-block p-4 text-lg bg-green-500 rounded text-white"
            >
              Become a Sponsor!
            </a>
          </div>
          <div tw="h-4" />
          <p tw="italic mx-auto max-w-screen-sm text-gray-500">
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
        tw="
          mt-12 max-w-screen-md mx-4 rounded-md p-4 shadow-lg grid gap-6
          bg-discord text-white overflow-hidden relative
          sm:(p-8 mx-auto grid-cols-3)"
      >
        <div
          tw="absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:(opacity-20)
        "
        >
          <Image src="/img/discord-logo-white.svg" width={300} height={300} />
        </div>
        <div tw="sm:(col-span-2)">
          <h3 tw="text-3xl">TanStack on Discord</h3>
          <p tw="mt-4">
            The official TanStack community to ask questions, network and make
            new friends and get lightning fast news about what's coming next for
            TanStack!
          </p>
        </div>
        <div tw="flex items-center justify-center">
          <a
            href="https://discord.com/invite/WrRKjPJ"
            target="_blank"
            rel="noreferrer"
            tw="block w-full mt-4 px-4 py-2 bg-white text-discord text-center text-lg rounded shadow-lg z-10"
          >
            Join TanStack Discord
          </a>
        </div>
      </div>
      <div tw="h-20" />
      <div tw="bg-gray-800 text-white shadow-lg">
        <div tw="max-w-screen-md mx-auto py-12 px-4">
          <div tw="grid gap-1 md:(grid-cols-2)">
            {footerLinks.map((link) => (
              <div key={link.href}>
                <Link href={link.href}>
                  <Anchor href={link.href} tw="hover:underline">
                    {link.name}
                  </Anchor>
                </Link>
              </div>
            ))}
          </div>
        </div>
        <div tw="text-center opacity-20 text-sm">
          &copy; {new Date().getFullYear()} Tanner Linsley
        </div>
        <div tw="h-8"></div>
      </div>
    </div>
  )
}
