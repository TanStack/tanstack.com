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
import {
  canonicalUrl,
  getCanonicalPath,
  seo,
  shouldIndexPath,
} from '~/utils/seo'
import ogImage from '~/images/og.png'
const LazyAppDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import('~/components/AppDevtools').then((m) => ({
        default: m.AppDevtools,
      })),
    )
  : null
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
import { trackPageView } from '~/utils/analytics'
import { twMerge } from 'tailwind-merge'

const GOOGLE_ANALYTICS_ID = 'G-JMT1Z50SPS'
const GOOGLE_ANALYTICS_PROXY_PREFIX = '/_a'
const GOOGLE_ANALYTICS_SCRIPT_SRC = `${GOOGLE_ANALYTICS_PROXY_PREFIX}/gtag.js`
const GOOGLE_ANALYTICS_BOOTSTRAP = `(function(){var id='${GOOGLE_ANALYTICS_ID}';var src='${GOOGLE_ANALYTICS_SCRIPT_SRC}';window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',id,{transport_url:window.location.origin+'${GOOGLE_ANALYTICS_PROXY_PREFIX}'});var loaded=false;var load=function(){if(loaded)return;loaded=true;var script=document.createElement('script');script.async=true;script.src=src;script.setAttribute('data-ga-loader','true');document.head.appendChild(script)};if(typeof window.requestIdleCallback==='function'){window.requestIdleCallback(load,{timeout:3000});return}if(document.readyState==='complete'){window.setTimeout(load,1500);return}window.addEventListener('load',function(){window.setTimeout(load,1500)},{once:true})})();`

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
      {
        rel: 'preload',
        href: '/fonts/Inter-latin.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'preload',
        href: '/fonts/Inter-latin.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
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
      // Theme detection script - must run before body renders to prevent flash
      {
        children: `(function(){try{var t=localStorage.getItem('theme')||'auto';var v=['light','dark','auto'].includes(t)?t:'auto';if(v==='auto'){var a=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.add(a,'auto')}else{document.documentElement.classList.add(v)}}catch(e){var a=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.add(a,'auto')}})()`,
      },
      {
        children: GOOGLE_ANALYTICS_BOOTSTRAP,
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

  const isNavigating = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  })

  const [canShowDevtools, setCanShowDevtools] = React.useState(false)
  const [showNavigationSpinner, setShowNavigationSpinner] =
    React.useState(false)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setCanShowDevtools(true)
    }, 2000)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  React.useEffect(() => {
    if (!isNavigating) {
      setShowNavigationSpinner(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setShowNavigationSpinner(true)
    }, 1000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [isNavigating])

  const canonicalPath = useRouterState({
    select: (s) => s.location?.pathname || '/',
  })

  const canonicalSearchStr = useRouterState({
    select: (s) => s.location?.searchStr || '',
  })

  const includeSearchInCanonical = useMatches({
    select: (s) =>
      s.some((d) => d.staticData?.includeSearchInCanonical === true),
  })

  const preferredCanonicalPath = getCanonicalPath(canonicalPath)
  const canonicalSearch = includeSearchInCanonical ? canonicalSearchStr : ''
  const pageUrl = canonicalUrl(
    preferredCanonicalPath ?? canonicalPath,
    canonicalSearch,
  )

  const showDevtools = import.meta.env.DEV && canShowDevtools

  const hideNavbar = useMatches({
    select: (s) => s.some((d) => d.staticData?.showNavbar === false),
  })

  const htmlClass = useHtmlClass()

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <head>
        {preferredCanonicalPath ? (
          <link
            rel="canonical"
            href={canonicalUrl(preferredCanonicalPath, canonicalSearch)}
          />
        ) : null}
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:url" content={pageUrl} />
        {!shouldIndexPath(canonicalPath) ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : null}
        <HeadContent />
        {hasBaseParent ? <base target="_parent" /> : null}
      </head>
      <body className="overflow-x-hidden">
        <LoginModalProvider>
          <ToastProvider>
            <PageViewTracker />
            {hideNavbar ? children : <Navbar>{children}</Navbar>}
            {showDevtools && LazyAppDevtools ? (
              <React.Suspense fallback={null}>
                <LazyAppDevtools />
              </React.Suspense>
            ) : null}
            <div
              aria-hidden="true"
              className={twMerge(
                'pointer-events-none fixed top-0 left-0 z-99999999 h-[320px] w-full select-none',
              )}
            >
              <div
                className={twMerge(
                  'absolute top-0 w-full h-80 rounded-[100%] bg-amber-500/30 blur-3xl transition-all duration-500 dark:bg-sky-400/25',
                  showNavigationSpinner
                    ? '-translate-y-1/2 opacity-100'
                    : '-translate-y-full opacity-0',
                )}
              />
              <div
                className={twMerge(
                  'absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-white/75 p-2 shadow-lg backdrop-blur-lg transition-all duration-300 dark:bg-slate-900/40',
                  showNavigationSpinner
                    ? 'translate-y-0 opacity-100'
                    : '-translate-y-6 opacity-0',
                )}
              >
                <Spinner className="text-4xl" />
              </div>
            </div>
            <SearchHotkeyController />
          </ToastProvider>
        </LoginModalProvider>
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
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.altKey || event.shiftKey) return
      // Match both `key` and `code` so the shortcut works on non-QWERTY layouts.
      const isK = event.key.toLowerCase() === 'k' || event.code === 'KeyK'
      if (!isK) return

      event.preventDefault()
      event.stopPropagation()
      setHasOpenedSearch(true)
      openSearch()
    }

    document.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, {
        capture: true,
      })
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

function PageViewTracker() {
  const pagePath = useRouterState({
    select: (s) => {
      const pathname = s.resolvedLocation?.pathname || '/'
      const search = s.resolvedLocation?.searchStr || ''

      return `${pathname}${search}`
    },
  })
  const hasTrackedInitialPage = React.useRef(false)

  React.useEffect(() => {
    if (!hasTrackedInitialPage.current) {
      hasTrackedInitialPage.current = true
      return
    }

    trackPageView(pagePath)
  }, [pagePath])

  return null
}
