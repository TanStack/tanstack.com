import * as React from 'react'
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useMatches,
  useRouterState,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'
import ogImage from '~/images/og.png'
import { TanStackRouterDevtoolsInProd } from '@tanstack/react-router-devtools'
import { NotFound } from '~/components/NotFound'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { GamScripts } from '~/components/Gam'
import { BackgroundGradient } from '~/components/BackgroundGradient'
import { SearchProvider } from '~/contexts/SearchContext'
import { SearchModal } from '~/components/SearchModal'
import { ToastProvider } from '~/components/ToastProvider'
import { Spinner } from '~/components/Spinner'
import { ThemeProvider } from '~/components/ThemeProvider'
import { Navbar } from '~/components/Navbar'

// import { LibrariesLayout } from './_libraries/route'
import { THEME_COLORS } from '~/utils/utils'
import { useHubSpotChat } from '~/hooks/useHubSpotChat'
// import { getCurrentUser } from '~/utils/auth.server'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  // user?: Awaited<ReturnType<typeof getCurrentUser>>
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
      {
        name: 'theme-color',
        content: THEME_COLORS.light,
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: THEME_COLORS.dark,
        media: '(prefers-color-scheme: dark)',
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
      { rel: 'preload', href: appCss, as: 'style' },
      { rel: 'stylesheet', href: appCss },
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
        href: '/fonts/Inter.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: '',
      },
    ],
    scripts: [
      // Google Tag Manager - deferred until user interaction or timeout
      {
        children: `
          (function(){
            var loaded=false;
            function loadGTM(){
              if(loaded)return;
              loaded=true;
              var w=window,d=document,l='dataLayer',i='GTM-5N57KQT4';
              w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName('script')[0],j=d.createElement('script');
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;
              f.parentNode.insertBefore(j,f);
            }
            ['scroll','click','touchstart','keydown'].forEach(function(e){
              window.addEventListener(e,loadGTM,{once:true,passive:true});
            });
            setTimeout(loadGTM,4000);
          })();
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

    // Initialize user as undefined - routes can opt-in to load auth if needed
    // Use undefined instead of null to distinguish between "not loaded" and "no user"
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
        {/* <LibrariesLayout> */}
        <NotFound />
        {/* </LibrariesLayout> */}
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
  return (
    <ThemeProvider>
      <SearchProvider>
        <HtmlWrapper>{children}</HtmlWrapper>
      </SearchProvider>
    </ThemeProvider>
  )
}

function HtmlWrapper({ children }: { children: React.ReactNode }) {
  const matches = useMatches()

  // HubSpot chat loads on configured pages (see useHubSpotChat hook)
  useHubSpotChat()

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

  const hideNavbar = useMatches({
    select: (s) => s.some((d) => d.staticData?.showNavbar === false),
  })

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        <GamScripts />
      </head>
      <body className="overflow-x-hidden">
        <ToastProvider>
          <BackgroundGradient />
          <React.Suspense fallback={null}>
            {hideNavbar ? children : <Navbar>{children}</Navbar>}
          </React.Suspense>
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
                <Spinner className="text-5xl" />
              </div>
            </div>
          ) : null}
          <SearchModal />
        </ToastProvider>
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
