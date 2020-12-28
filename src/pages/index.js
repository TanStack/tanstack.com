import React from 'react'
import Image from 'next/Image'
import Link from 'next/Link'
import tw, { theme } from 'twin.macro'

import Nav from '../components/Nav'

const libraries = [
  {
    name: 'React Query',
    styles: tw`bg-red-500 hover:(border-red-500 bg-transparent text-red-400)`,
    href: 'https://react-query.tanstack.com',
    tagline: `Performant and powerful data synchronization for React`,
    description: `Fetch, cache and update data in your React and React Native applications all without touching any "global state".`,
  },
  {
    name: 'React Table',
    styles: tw`bg-blue-700 hover:(border-blue-500 bg-transparent text-blue-400)`,
    href: 'https://react-table.tanstack.com',
    tagline: `Lightweight and extensible data tables for React`,
    description: `Build and design powerful datagrid experiences while retaining 100% control over markup and styles.`,
  },
  {
    name: 'React Charts',
    styles: tw`bg-yellow-500 text-black hover:(border-yellow-500 bg-transparent text-yellow-500)`,
    href: 'https://react-charts.tanstack.com',
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
  },
]

export default function IndexPage() {
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
              tw="col-span-2 p-3 placeholder-gray-400 text-gray-700 bg-white rounded text-sm shadow outline-none focus:outline-none w-full text-white dark:(bg-gray-700)"
              name="email_address"
              placeholder="Your email address"
              type="text"
              required=""
            />
            <button
              data-element="submit"
              className="formkit-submit"
              tw="bg-blue-500 rounded"
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
        <h1 tw="text-4xl font-light">Products</h1>
        <div tw="mt-4 grid grid-cols-1 gap-4 sm:(grid-cols-2)">
          {libraries.map((library) => (
            <Link key={library.name} href={library.href}>
              <a
                href={library.href}
                css={[
                  tw`border-4 border-transparent rounded-lg p-4 md:(p-10) text-white transition-all`,
                  library.styles,
                ]}
              >
                <div tw="text-3xl font-bold ">{library.name}</div>
                <div tw="text-lg italic font-extralight mt-2">
                  {library.tagline}
                </div>
                <div tw="text-sm mt-2">{library.description}</div>
              </a>
            </Link>
          ))}
        </div>
      </div>
      <div tw="h-20" />
    </div>
  )
}
