import * as React from 'react'
import {
  Outlet,
  ScriptOnce,
  ScrollRestoration,
  createRootRouteWithContext,
  redirect,
  useMatches,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import carbonStyles from '~/styles/carbon.css?url'
import { seo } from '~/utils/seo'
import ogImage from '~/images/og.png'
import { Scripts, Meta } from '@tanstack/start'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { NotFound } from '~/components/NotFound'
import { CgSpinner } from 'react-icons/cg'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import background from '~/images/background.jpg'
import { twMerge } from 'tailwind-merge'
import { getThemeCookie, useThemeStore } from '~/components/ThemeToggle'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title:
          'TanStack | High Quality Open-Source Software for Web Developers',
        description: `Headless, type-safe, powerful utilities for complex workflows like Data Management, Data Visualization, Charts, Tables, and UI Components.`,
        image: `https://tanstack.com${ogImage}`,
        keywords:
          'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: carbonStyles,
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
    scripts: [
      {
        src: 'https://www.googletagmanager.com/gtag/js?id=G-JMT1Z50SPS',
        async: true,
      },
      {
        children: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
  
          gtag('config', 'G-JMT1Z50SPS');
        `,
      },
    ],
  }),
  beforeLoad: async (ctx) => {
    if (
      ctx.location.href.match(/\/docs\/(react|vue|angular|svelte|solid)\//gm)
    ) {
      throw redirect({
        href: ctx.location.href.replace(
          /\/docs\/(react|vue|angular|svelte|solid)\//gm,
          '/docs/framework/$1/'
        ),
      })
    }
  },
  staleTime: Infinity,
  loader: async () => {
    return {
      themeCookie: await getThemeCookie(),
    }
  },
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },
  notFoundComponent: () => {
    return (
      <RootDocument>
        <NotFound />
      </RootDocument>
    )
  },
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { themeCookie } = Route.useLoaderData()

  React.useEffect(() => {
    useThemeStore.setState({ mode: themeCookie })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const matches = useMatches()

  const isLoading = useRouterState({
    select: (s) => s.status === 'pending',
  })

  const [showLoading, setShowLoading] = React.useState(false)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoading(true)
    }, 2000)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  const isRouterPage = useRouterState({
    select: (s) => s.resolvedLocation.pathname.startsWith('/router'),
  })

  const showDevtools = showLoading && isRouterPage

  const pathLength = useRouterState({
    select: (s) =>
      Math.max(
        0,
        s.location.pathname.replace('/docs/framework', '').split('/').length - 2
      ),
  })

  const themeClass = themeCookie === 'dark' ? 'dark' : ''

  return (
    <html lang="en" className={themeClass}>
      <head>
        {/* If the theme is set to auto, inject a tiny script to set the proper class on html based on the user preference */}
        {themeCookie === 'auto' ? (
          <ScriptOnce
            children={`window.matchMedia('(prefers-color-scheme: dark)').matches ? document.documentElement.classList.add('dark') : null`}
          />
        ) : null}
        <Meta />
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
      </head>
      <body>
        <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-10 pointer-events-none blur-sm" />
        <div
          className={twMerge(
            'fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-10 pointer-events-none dark:opacity-20 transition-all duration-[2.5s] ease-in-out',
            `[&+*]:relative`
          )}
          style={{
            backgroundImage: `url(${background})`,
            backgroundSize: 'cover',
            backgroundPosition: 'bottom',
            backgroundRepeat: 'no-repeat',
            filter: `blur(${pathLength * 2}px)`,
            transform: `scale(${1 + pathLength * 0.05})`,
          }}
        />
        <React.Suspense fallback={null}>{children}</React.Suspense>
        {showDevtools ? (
          <TanStackRouterDevtools position="bottom-right" />
        ) : null}
        {showLoading ? (
          <div
            className={`fixed top-0 left-0 h-[300px] w-full
        transition-all duration-300 pointer-events-none
        z-30 dark:h-[200px] dark:!bg-white/10 dark:rounded-[100%] ${
          isLoading
            ? 'delay-0 opacity-1 -translate-y-1/2'
            : 'delay-300 opacity-0 -translate-y-full'
        }`}
            style={{
              background: `radial-gradient(closest-side, rgba(0,10,40,0.2) 0%, rgba(0,0,0,0) 100%)`,
            }}
          >
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[30px] p-2 bg-white/80 dark:bg-gray-800
        rounded-lg shadow-lg`}
            >
              <CgSpinner className="text-3xl animate-spin" />
            </div>
          </div>
        ) : null}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// export function Html({ children, ...props }: React.HTMLProps<HTMLHtmlElement>) {
//   const router = useRouter()

//   // warning(
//   //   !Object.keys(props).length,
//   //   'Passing props other than children to the Html component will be supported very soon in React 19.',
//   // )

//   if (!router.isServer) {
//     return <>{children}</>
//   }

//   return <html>{children}</html>
// }

// export function Head({ children, ...props }: React.HTMLProps<HTMLHeadElement>) {
//   const router = useRouter()

//   // warning(
//   //   !Object.keys(props).length,
//   //   'Passing props other than children to the Head component will be supported very soon in React 19.',
//   // )

//   if (!router.isServer) {
//     return children
//   }

//   return <head>{children}</head>
// }

// export function Body({ children, ...props }: React.HTMLProps<HTMLBodyElement>) {
//   const router = useRouter()

//   // warning(
//   //   !Object.keys(props).length,
//   //   'Passing props other than children to the Body component will be supported very soon in React 19.',
//   // )

//   if (!router.isServer) {
//     return children
//   }

//   return <body>{children}</body>
// }
