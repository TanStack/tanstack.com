import * as React from 'react'
import {
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
const LazyRouterDevtools = React.lazy(() =>
  import('@tanstack/react-router-devtools').then((m) => ({
    default: m.TanStackRouterDevtoolsInProd,
  })),
)
import { NotFound } from '~/components/NotFound'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { SearchProvider, useSearchContext } from '~/contexts/SearchContext'
import { ToastProvider } from '~/components/ToastProvider'
import { LoginModalProvider } from '~/contexts/LoginModalContext'

const LazySearchModal = React.lazy(() =>
  import('~/components/SearchModal').then((m) => ({ default: m.SearchModal })),
)
import { Spinner } from '~/components/Spinner'
import { ThemeProvider, useHtmlClass } from '~/components/ThemeProvider'
import { Navbar } from '~/components/Navbar'
import { THEME_COLORS } from '~/utils/utils'
import { useHubSpotChat } from '~/hooks/useHubSpotChat'

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
    ],
    scripts: [
      // Theme detection script - must run before body renders to prevent flash
      {
        children: `(function(){try{var t=localStorage.getItem('theme')||'auto';var v=['light','dark','auto'].includes(t)?t:'auto';if(v==='auto'){var a=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.add(a,'auto')}else{document.documentElement.classList.add(v)}}catch(e){var a=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.add(a,'auto')}})()`,
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
  shellComponent: ({ children }) => {
    return (
      <ThemeProvider>
        <SearchProvider>
          <ShellComponent>{children}</ShellComponent>
        </SearchProvider>
      </ThemeProvider>
    )
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
})

function ShellComponent({ children }: { children: React.ReactNode }) {
  const hasBaseParent = useMatches({
    select: (matches) => matches.find((d) => d.staticData?.baseParent),
  })

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

  const htmlClass = useHtmlClass()

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <head>
        <HeadContent />
        {hasBaseParent ? <base target="_parent" /> : null}
      </head>
      <body className="overflow-x-hidden">
        <LoginModalProvider>
          <ToastProvider>
            <IdleGtmLoader />
            {hideNavbar ? children : <Navbar>{children}</Navbar>}
            {showDevtools ? (
              <LazyRouterDevtools position="bottom-right" />
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
            <SearchHotkeyController />
          </ToastProvider>
        </LoginModalProvider>
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

function SearchHotkeyController() {
  const { isOpen, openSearch } = useSearchContext()
  const [hasOpenedSearch, setHasOpenedSearch] = React.useState(false)

  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'k') return

      event.preventDefault()
      setHasOpenedSearch(true)
      openSearch()
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [openSearch])

  React.useEffect(() => {
    if (isOpen) {
      setHasOpenedSearch(true)
    }
  }, [isOpen])

  if (!hasOpenedSearch) return null

  return (
    <React.Suspense fallback={null}>
      <LazySearchModal />
    </React.Suspense>
  )
}

function IdleGtmLoader() {
  React.useEffect(() => {
    const gtmId = 'GTM-5N57KQT4'
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src*="googletagmanager.com/gtm.js?id=${gtmId}"]`,
    )

    if (existingScript) return

    const inject = () => {
      if (!window.dataLayer) {
        window.dataLayer = []
      }

      window.dataLayer.push({
        'gtm.start': Date.now(),
        event: 'gtm.js',
      })

      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`
      document.head.appendChild(script)
    }

    if ('requestIdleCallback' in window) {
      const idleHandle = window.requestIdleCallback(inject, { timeout: 2500 })
      return () => {
        window.cancelIdleCallback(idleHandle)
      }
    }

    const timeoutHandle = globalThis.setTimeout(inject, 2500)
    return () => {
      globalThis.clearTimeout(timeoutHandle)
    }
  }, [])

  return null
}
