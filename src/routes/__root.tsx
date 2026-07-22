import * as React from 'react'
import {
  createRootRouteWithContext,
  useMatches,
  useRouterState,
  HeadContent,
  Scripts,
  defaultStringifySearch,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { createThemeCss, type HighlightTheme } from '@tanstack/highlight/theme'
import { auroraXTheme } from '@tanstack/highlight/themes/aurora-x'
import { githubLightTheme } from '@tanstack/highlight/themes/github-light'
import '~/styles/app.css'
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
import { SearchProvider } from '~/contexts/SearchContext'
import { ToastProvider } from '~/components/ToastProvider'
import { LoginModalProvider } from '~/contexts/LoginModalContext'
import { LibrariesOverlayProvider } from '~/contexts/LibrariesOverlayContext'

import { Spinner } from '~/components/Spinner'
import { ThemeProvider, useHtmlClass } from '~/components/ThemeProvider'
import { Navbar } from '~/components/Navbar'
import { THEME_COLORS } from '~/utils/utils'
import { trackPageView } from '~/utils/analytics'
import { createPartnerPlacementSessionSeed } from '~/utils/partner-placement'
import { twMerge } from 'tailwind-merge'

const GOOGLE_ANALYTICS_ID = 'G-JMT1Z50SPS'
const GOOGLE_ANALYTICS_PROXY_PREFIX = '/_a'
const GOOGLE_ANALYTICS_SCRIPT_SRC = `${GOOGLE_ANALYTICS_PROXY_PREFIX}/gtag.js`
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('theme')||'auto';var v=['light','dark','auto'].includes(t)?t:'auto';var r=v==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):v;document.documentElement.classList.add(r);if(v==='auto')document.documentElement.classList.add('auto');document.documentElement.style.colorScheme=r}catch(e){var r=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.add(r,'auto');document.documentElement.style.colorScheme=r}})()`
const GOOGLE_ANALYTICS_BOOTSTRAP = `(function(){var id='${GOOGLE_ANALYTICS_ID}';var src='${GOOGLE_ANALYTICS_SCRIPT_SRC}';window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',id,{transport_url:window.location.origin+'${GOOGLE_ANALYTICS_PROXY_PREFIX}'});var loaded=false;var load=function(){if(loaded)return;loaded=true;var script=document.createElement('script');script.async=true;script.src=src;script.setAttribute('data-ga-loader','true');document.head.appendChild(script)};if(typeof window.requestIdleCallback==='function'){window.requestIdleCallback(load,{timeout:3000});return}if(document.readyState==='complete'){window.setTimeout(load,1500);return}window.addEventListener('load',function(){window.setTimeout(load,1500)},{once:true})})();`
const DOCUMENT_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Cloudflare-CDN-Cache-Control': 'no-store',
}
const tanstackNeutralDarkTheme = {
  ...auroraXTheme,
  background: '#111111',
  foreground: '#d4d4d4',
  name: 'tanstack-neutral-dark',
  tokens: {
    ...auroraXTheme.tokens,
    comment: '#a3a3a3',
    meta: '#737373',
    token: '#d4d4d4',
  },
} satisfies HighlightTheme
const HIGHLIGHT_THEME_CSS = createThemeCss({
  light: githubLightTheme,
  dark: tanstackNeutralDarkTheme,
  darkSelector: '.dark',
})

type CanonicalHeadMatch = {
  pathname: string
  search: Record<string, unknown>
  staticData?: {
    includeSearchInCanonical?: boolean
  }
}

function getCanonicalHeadTags(matches: ReadonlyArray<CanonicalHeadMatch>): {
  links: Array<React.JSX.IntrinsicElements['link']>
  meta: Array<React.JSX.IntrinsicElements['meta']>
} {
  const lastMatch = matches[matches.length - 1]
  const canonicalPath = lastMatch?.pathname ?? '/'
  const includeSearchInCanonical = matches.some(
    (match) => match.staticData?.includeSearchInCanonical === true,
  )
  const canonicalSearch =
    includeSearchInCanonical && lastMatch
      ? defaultStringifySearch(lastMatch.search)
      : ''
  const preferredCanonicalPath = getCanonicalPath(canonicalPath)
  const pageUrl = canonicalUrl(
    preferredCanonicalPath ?? canonicalPath,
    canonicalSearch,
  )

  return {
    links: preferredCanonicalPath
      ? [
          {
            rel: 'canonical',
            href: canonicalUrl(preferredCanonicalPath, canonicalSearch),
          },
        ]
      : [],
    meta: [
      { property: 'og:url', content: pageUrl },
      { name: 'twitter:url', content: pageUrl },
      ...(!shouldIndexPath(canonicalPath)
        ? [{ name: 'robots', content: 'noindex, nofollow' }]
        : []),
    ],
  }
}

class OptionalDevtoolsBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      console.warn('TanStack Devtools failed to load', error)
    }
  }

  render() {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  loader: () => {
    return {
      partnerPlacementSessionSeed: createPartnerPlacementSessionSeed(),
    }
  },
  head: ({ matches }) => {
    const canonicalHeadTags = getCanonicalHeadTags(matches)

    return {
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
        ...canonicalHeadTags.meta,
      ],
      links: [
        ...canonicalHeadTags.links,
        {
          rel: 'preload',
          href: '/fonts/Inter-latin.woff2',
          as: 'font',
          type: 'font/woff2',
          crossOrigin: 'anonymous',
        },
        // Rebrand type system: Bricolage Grotesque (display/headings) + IBM Plex
        // Mono (code). Loaded globally so the new styles apply across the site.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@300;400;500&display=swap',
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
      scripts: [{ children: GOOGLE_ANALYTICS_BOOTSTRAP }],
    }
  },
  headers: () => DOCUMENT_CACHE_HEADERS,
  staleTime: Infinity,
  shellComponent: ({ children }) => {
    return <RootShell>{children}</RootShell>
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
})

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SearchProvider>
        <ShellComponent>{children}</ShellComponent>
      </SearchProvider>
    </ThemeProvider>
  )
}

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

  const showDevtools = import.meta.env.DEV && canShowDevtools

  const hideNavbar = useMatches({
    select: (s) => s.some((d) => d.staticData?.showNavbar === false),
  })

  const htmlClass = useHtmlClass()

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
          suppressHydrationWarning
        />
        <HeadContent />
        <style
          id="tanstack-highlight-theme"
          dangerouslySetInnerHTML={{ __html: HIGHLIGHT_THEME_CSS }}
        />
        {hasBaseParent ? <base target="_parent" /> : null}
      </head>
      <body className="overflow-x-hidden">
        <LoginModalProvider>
          <ToastProvider>
            <PageViewTracker />
            <LibrariesOverlayProvider>
              {hideNavbar ? children : <Navbar>{children}</Navbar>}
            </LibrariesOverlayProvider>
            {showDevtools && LazyAppDevtools ? (
              <OptionalDevtoolsBoundary>
                <React.Suspense fallback={null}>
                  <LazyAppDevtools />
                </React.Suspense>
              </OptionalDevtoolsBoundary>
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
          </ToastProvider>
        </LoginModalProvider>
        <Scripts />
      </body>
    </html>
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
