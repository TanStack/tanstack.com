import { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  ScriptOnce,
  Scripts,
  useMatches,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsInProd } from '@tanstack/react-router-devtools'
import { BackgroundAnimation } from '~/components/BackgroundAnimation'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { GoogleScripts } from '~/components/GoogleScripts'
import { NotFound } from '~/components/NotFound'
import { SearchModal } from '~/components/SearchModal'
import { getThemeCookie, useThemeStore } from '~/components/ThemeToggle'
import { SearchProvider } from '~/contexts/SearchContext'
import ogImage from '~/images/og.png'
import appCss from '~/styles/app.css?url'
import carbonStyles from '~/styles/carbon.css?url'
import { seo } from '~/utils/seo'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import { CgSpinner } from 'react-icons/cg'

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
      {
        name: 'google-adsense-account',
        content: 'ca-pub-9403278435468733',
      },
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
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: '' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
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
          '/docs/framework/$1/',
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
    <SearchProvider>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </SearchProvider>
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
        <HeadContent />
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        <GoogleScripts />
      </head>
      <body>
        <BackgroundAnimation />
        <React.Suspense fallback={null}>{children}</React.Suspense>
        {showDevtools ? (
          <TanStackRouterDevtoolsInProd position="bottom-right" />
        ) : null}
        {canShowLoading ? (
          <div
            className={`pointer-events-none fixed top-0 left-0 z-30 h-[300px] w-full transition-all duration-300 dark:h-[200px] dark:rounded-[100%] dark:!bg-white/10 ${
              isLoading
                ? '-translate-y-1/2 opacity-1 delay-500'
                : '-translate-y-full opacity-0 delay-0'
            }`}
            style={{
              background: `radial-gradient(closest-side, rgba(0,10,40,0.2) 0%, rgba(0,0,0,0) 100%)`,
            }}
          >
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[30px] rounded-lg bg-white/80 p-2 shadow-lg dark:bg-gray-800`}
            >
              <CgSpinner className="animate-spin text-3xl" />
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
