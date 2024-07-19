import * as React from 'react'
import { Link } from '@tanstack/react-router'
import agGridImage from '~/images/ag-grid.png'
import agGridDarkSvg from '~/images/ag-grid-dark.svg'
import agGridLightSvg from '~/images/ag-grid-light.svg'
import nozzleImage from '~/images/nozzle.png'
import nozzleDarkSvg from '~/images/nozzle-dark.svg'
import nozzleLightSvg from '~/images/nozzle-light.svg'
import bytesUidotdevImage from '~/images/bytes-uidotdev.png'
import vercelLightSvg from '~/images/vercel-light.svg'
import vercelDarkSvg from '~/images/vercel-dark.svg'
import convexWhiteSvg from '~/images/convex-white.svg'
import convexColorSvg from '~/images/convex-color.svg'
import sentryWordMarkLightSvg from '~/images/sentry-wordmark-light.svg'
import sentryWordMarkDarkSvg from '~/images/sentry-wordmark-dark.svg'
import { Library } from '~/libraries'

type Partner = {
  name: string
  libraries?: Library['id'][]
  sidebarImgLight?: string
  sidebarImgDark?: string
  href: string
  homepageImg: JSX.Element
  content: JSX.Element
  sidebarImgClass?: string
}

export const partners: Partner[] = [
  (() => {
    const href = 'https://vercel.com?utm_source=tanstack'

    return {
      name: 'Vercel',
      href,
      libraries: ['start', 'router'],
      sidebarImgLight: vercelLightSvg,
      sidebarImgDark: vercelDarkSvg,
      sidebarImgClass: 'py-4',
      homepageImg: (
        <a
          href={href}
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
            TanStack Router/Start and Vercel are a match made in heaven.
            Vercel's{' '}
            <strong>cutting-edge deployment and serverless capabilities</strong>{' '}
            continue to deliver on the TanStack promise for apps to be{' '}
            <strong>high-performant and scalable</strong>. We're working closely
            with Vercel to not only ensure a flawless deployment experience, but
            also push the boundaries of what's possible with TanStack on the
            web.
          </div>
          <a
            href={href}
            target="_blank"
            className="text-blue-500 uppercase font-black text-sm"
          >
            Learn More
          </a>
        </>
      ),
    }
  })(),
  (() => {
    const href =
      'https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable'

    return {
      name: 'AG Grid',
      libraries: ['table'],
      sidebarImgLight: agGridDarkSvg,
      sidebarImgDark: agGridLightSvg,
      sidebarImgClass: 'py-5 scale-[1.1]',
      href,
      homepageImg: (
        <a href={href} target="_blank" className="px-8 py-6">
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
            <strong>best table/datagrid libraries around</strong>, so we've
            teamed up to ensure the highest quality table/datagrid options are
            available for the entire JS/TS ecosystem and every use-case
            imaginable for UI/UX developers. If it's a table/datagrid, we've got
            you covered.
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
    }
  })(),
  (() => {
    const href = 'https://convex.dev?utm_source=tanstack'

    return {
      name: 'Convex',
      libraries: ['start', 'router'],
      sidebarImgLight: convexColorSvg,
      sidebarImgDark: convexWhiteSvg,
      sidebarImgClass: 'py-1.5 scale-[1.3]',
      href,
      homepageImg: (
        <a
          href={href}
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
            <strong>first-class end-to-end type-safe experience</strong> to
            TanStack developers, but to also ensure TanStack is ready for the
            real-time database arena. Convex's all-in-one platform delivers
            end-to-end type-safety via a{' '}
            <strong>revolutionary relational, real-time database</strong> and
            together, we're elevating what's possible with real-time React
            applications.
          </div>
          <a
            href={href}
            target="_blank"
            className="text-blue-500 uppercase font-black text-sm"
          >
            Learn More
          </a>
        </>
      ),
    }
  })(),
  (() => {
    const href = 'https://sentry.io?utm_source=tanstack'

    return {
      name: 'Sentry',
      libraries: ['start', 'router'],
      sidebarImgLight: sentryWordMarkDarkSvg,
      sidebarImgDark: sentryWordMarkLightSvg,
      sidebarImgClass: 'py-2 scale-[1.1]',
      href,
      homepageImg: (
        <a
          href={href}
          target="_blank"
          className="dark:bg-black w-full h-full flex items-center justify-center px-4 py-6"
        >
          <img
            src={sentryWordMarkDarkSvg}
            alt="Sentry"
            className="w-[275px] max-w-full dark:hidden"
          />
          <img
            src={sentryWordMarkLightSvg}
            alt="Sentry"
            className="w-[275px] max-w-full hidden dark:block"
          />
        </a>
      ),
      content: (
        <>
          <div>
            Sentry and TanStack are on a mission to make sure your apps are
            <strong> error-free and high-performers</strong>. Sentry's
            best-in-class error monitoring and performance insights combined
            with TanStack's cutting-edge libraries ensure that you can deliver
            the best possible experience to your users. Together, we're
            committed to making sure that you can build with confidence.
          </div>
          <a
            href={href}
            target="_blank"
            className="text-blue-500 uppercase font-black text-sm"
          >
            Learn More
          </a>
        </>
      ),
    }
  })(),
  (() => {
    const href = 'https://bytes.dev?utm_source-tanstack&utm_campaign=tanstack'

    return {
      name: 'UI.dev',
      libraries: [],
      href,
      homepageImg: (
        <a href={href} target="_blank" className="py-6">
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
            TanStack's priority is to make its users productive, efficient and
            knowledgeable about web dev. To help us on this quest, we've
            partnered with{' '}
            <a
              target="_blank"
              className="text-blue-500 underline"
              href="https://ui.dev/?utm_source=tanstack&utm_campaign=tanstack"
            >
              ui.dev
            </a>{' '}
            to <strong>provide best-in-class education</strong> about TanStack
            products. It doesn't stop at TanStack though, with their sister
            product{' '}
            <a target="_blank" className="text-blue-500 underline" href={href}>
              Bytes.dev
            </a>{' '}
            as our official newsletter partner, you'll be able to{' '}
            <strong>stay up to date with the latest and greatest</strong> in the
            web dev world regardless.
          </div>
          <a
            href={href}
            target="_blank"
            className="text-blue-500 uppercase font-black text-sm"
          >
            Learn More
          </a>
        </>
      ),
    }
  })(),
  (() => {
    const href = 'https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack'

    return {
      name: 'Nozzle.io',
      href,
      sidebarImgLight: nozzleDarkSvg,
      sidebarImgDark: nozzleLightSvg,
      sidebarImgClass: 'w-[150px] py-4',
      homepageImg: (
        <a href={href} target="_blank" className="py-6">
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
            Since its founding, Nozzle's SEO platform was the original home for
            almost all TanStack libraries. They were used to build the{' '}
            <strong>
              most technically advanced search engine monitoring platform
            </strong>{' '}
            of its kind. Its enterprise rank tracking and keyword research tools
            continue to set a new bar for quality and scale. Nozzle continues to
            prove the value of the full gamut of TanStack tools on the front-end
            with unmatched UI/UX.
          </div>
          <a
            href={href}
            target="_blank"
            className="text-blue-500 uppercase font-black text-sm"
          >
            Learn More
          </a>
        </>
      ),
    }
  })(),
] as const
