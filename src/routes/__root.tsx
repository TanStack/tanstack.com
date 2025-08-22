import * as React from 'react'
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useMatches,
  useRouterState,
  HeadContent,
  Scripts,
  useRouteContext,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import carbonStyles from '~/styles/carbon.css?url'
import { seo } from '~/utils/seo'
import ogImage from '~/images/og.png'
import { TanStackRouterDevtoolsInProd } from '@tanstack/react-router-devtools'
import { NotFound } from '~/components/NotFound'
import { CgSpinner } from 'react-icons/cg'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { GamScripts } from '~/components/Gam'
import { BackgroundAnimation } from '~/components/BackgroundAnimation'
import { SearchProvider } from '~/contexts/SearchContext'
import { SearchModal } from '~/components/SearchModal'
import { ThemeProvider } from '~/components/ThemeProvider'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexReactClient } from 'convex/react'

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from '../utils/auth.client'

import { LibrariesLayout } from './_libraries/route'
import { TanStackUser } from 'convex/auth'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
  ensureUser: () => Promise<TanStackUser>
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
      {
        rel: 'preload',
        href: '/fonts/inter-v19-latin-regular.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: '',
      },
      {
        rel: 'preload',
        href: '/fonts/inter-v19-latin-700.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: '',
      },
      {
        rel: 'preload',
        href: '/fonts/inter-v19-latin-800.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: '',
      },
      {
        rel: 'preload',
        href: '/fonts/inter-v19-latin-900.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: '',
      },
    ],
    scripts: [
      // Google Tag Manager script
      {
        children: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-5N57KQT4');
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

    // // During SSR only (the only time serverHttpClient exists),
    // // set the auth token for Convex to make HTTP queries with.
    // if (token) {
    //   ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    // }
  },
  staleTime: Infinity,
  errorComponent: (props) => {
    return (
      <HtmlWrapper>
        <DefaultCatchBoundary {...props} />
      </HtmlWrapper>
    )
  },
  notFoundComponent: () => {
    return (
      <DocumentWrapper>
        <LibrariesLayout>
          <NotFound />
        </LibrariesLayout>
      </DocumentWrapper>
    )
  },
  component: () => {
    return (
      <DocumentWrapper>
        <Outlet />
      </DocumentWrapper>
    )
  },
})

function DocumentWrapper({ children }: { children: React.ReactNode }) {
  const context = useRouteContext({ from: Route.id })

  return (
    <ConvexBetterAuthProvider
      client={context.convexClient}
      authClient={authClient}
    >
      <ThemeProvider>
        <SearchProvider>
          <HtmlWrapper>{children}</HtmlWrapper>
        </SearchProvider>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  )
}

function HtmlWrapper({ children }: { children: React.ReactNode }) {
  const matches = useMatches()

  const isLoading = useRouterState({
    select: (s) => s.status === 'pending',
  })

  const [canShowLoading, setShowLoading] = React.useState(false)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoading(true)
    }, 2000)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  const isRouterPage = useRouterState({
    select: (s) => s.resolvedLocation?.pathname.startsWith('/router'),
  })

  const showDevtools = canShowLoading && isRouterPage

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        <GamScripts />
      </head>
      <body>
        <BackgroundAnimation />
        <React.Suspense fallback={null}>{children}</React.Suspense>
        {showDevtools ? (
          <TanStackRouterDevtoolsInProd position="bottom-right" />
        ) : null}
        {canShowLoading ? (
          <div
            className={`fixed top-0 left-0 h-[300px] w-full
        transition-all duration-300 pointer-events-none
        z-30 dark:h-[200px] dark:bg-white/10! dark:rounded-[100%] ${
          isLoading
            ? 'delay-500 opacity-1 -translate-y-1/2'
            : 'delay-0 opacity-0 -translate-y-full'
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
        <SearchModal />
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5N57KQT4"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="gtm"
          ></iframe>
        </noscript>
        <Scripts />
      </body>
    </html>
  )
}
