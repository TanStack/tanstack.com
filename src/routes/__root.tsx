import * as React from 'react'
import {
  createRootRouteWithContext,
  RouterContextProvider,
  useMatches,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  defaultStringifySearch,
} from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  ConsentBanner,
  ConsentDialog,
  ConsentRoot,
  type ConsentRootProps,
} from '@c15t/tanstack-start'
import { consentLoaderOptions } from '@c15t/tanstack-start/server'
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
import { Footer } from '~/components/Footer'
import { ProductScarf } from '~/components/ProductScarf'
import {
  BuilderRouteFrame,
  BuilderRouteSkeleton,
} from '~/chat/components/projects/Loading'
import { THEME_COLORS } from '~/utils/utils'
import { trackPageView } from '~/utils/analytics'
import {
  trackScarfClipboardEvent,
  trackScarfDownloadClick,
  trackScarfExternalLinkClick,
  trackScarfExternalLinkHoverIntent,
  trackScarfPageView,
} from '~/utils/analytics/scarf'
import { createPartnerPlacementSessionSeed } from '~/utils/partner-placement'
import { consentScripts } from '~/utils/consent'
import { getConsentState } from '~/utils/consent.functions'
import { twMerge } from 'tailwind-merge'

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('theme')||'auto';var v=['light','dark','auto'].includes(t)?t:'auto';var r=v==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):v;if(document.documentElement){document.documentElement.classList.add(r);if(v==='auto')document.documentElement.classList.add('auto');document.documentElement.style.colorScheme=r}}catch(e){if(document.documentElement){var r=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.add(r,'auto');document.documentElement.style.colorScheme=r}}})()`

// The homepage renders the banner as a bar (variant="bar"); other pages get
// c15t's floating card. The bar classes key off the root's data-variant, so
// the card keeps c15t's layout. On the homepage the bar takes the hero frame's
// inset and corners. On large windows it replaces the stats strip under the
// hero and sticks below the navbar once scrolled there (see the consent block
// in app.css); elsewhere it keeps c15t's card surface, border and shadow so it
// has an edge wherever it lands. The copy and buttons sit side by side from
// lg, where c15t's bar stops stretching its button row to full width;
// switching earlier squeezes the copy into a narrow column.
const CONSENT_UI_OPTIONS = {
  // Scripts declare measurement, but only in production builds. Marketing
  // has no script; it covers the YouTube and Vimeo embeds.
  consentCategories: ['measurement', 'marketing'],
  components: {
    banner: {
      root: { className: 'group/banner' },
      cardShell: {
        className:
          'sm:group-data-[variant=bar]/banner:mx-2 sm:group-data-[variant=bar]/banner:mb-2 sm:group-data-[variant=bar]/banner:w-auto',
      },
      card: {
        className:
          'group-data-[variant=bar]/banner:flex group-data-[variant=bar]/banner:flex-col group-data-[variant=bar]/banner:gap-3 group-data-[variant=bar]/banner:rounded-none group-data-[variant=bar]/banner:px-6 group-data-[variant=bar]/banner:pt-4 group-data-[variant=bar]/banner:pb-[max(1rem,env(safe-area-inset-bottom))] sm:group-data-[variant=bar]/banner:rounded-2xl sm:group-data-[variant=bar]/banner:px-10 sm:group-data-[variant=bar]/banner:py-4 lg:group-data-[variant=bar]/banner:flex-row lg:group-data-[variant=bar]/banner:items-center lg:group-data-[variant=bar]/banner:justify-between lg:group-data-[variant=bar]/banner:gap-8 xl:group-data-[variant=bar]/banner:px-16',
      },
      header: {
        className:
          'group-data-[variant=bar]/banner:flex-row group-data-[variant=bar]/banner:flex-wrap group-data-[variant=bar]/banner:items-baseline group-data-[variant=bar]/banner:gap-x-3 group-data-[variant=bar]/banner:gap-y-1 group-data-[variant=bar]/banner:p-0',
      },
      title: {
        className:
          'font-ds-display font-semibold group-data-[variant=bar]/banner:text-ds-heading-6',
      },
      footer: {
        className:
          'group-data-[variant=bar]/banner:shrink-0 group-data-[variant=bar]/banner:border-0 group-data-[variant=bar]/banner:bg-transparent group-data-[variant=bar]/banner:p-0',
      },
    },
    description: {
      banner: { className: 'group-data-[variant=bar]/banner:text-ds-body-sm' },
      dialog: { className: 'text-ds-body-sm' },
    },
    dialog: {
      title: { className: 'font-ds-display font-semibold text-ds-heading-4' },
    },
    // Drop the margin c15t adds on top of the footer's own padding, which
    // left a gap under the categories that looked like a missing row.
    manager: {
      actions: { className: 'mt-0' },
    },
    // The site's Button (src/components/ds/ui): primary is the inverse pill,
    // secondary the ghost one. Secondary covers Customize in the banner and
    // Reject/Accept in the dialog, where Save is the main action.
    button: {
      primary: {
        className:
          'rounded-full corner-squircle border border-background-inverse bg-background-inverse px-4 py-2 text-sm font-medium text-text-inverse shadow-[0_1px_2px_0_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.18)] transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-background-inverse/90 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background-default',
      },
      secondary: {
        className:
          'rounded-full corner-squircle border border-border-default bg-transparent px-4 py-2 text-sm font-medium text-text-primary shadow-none transition-[box-shadow,background-color,border-color] duration-150 ease-out hover:border-border-strong hover:bg-background-subtle hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background-default',
      },
    },
  },
} satisfies ConsentRootProps['options']

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
    ownsCanonicalLink?: boolean
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
  // Routes whose canonical depends on loader data (e.g. old-version docs
  // canonicalizing to /latest) emit their own URL tags from their head().
  // The root must not also emit them — the router does not dedupe links, and
  // this head only sees pre-loader match snapshots, so it can't compute the
  // override itself.
  const ownsCanonicalLink = matches.some(
    (match) => match.staticData?.ownsCanonicalLink === true,
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
    links:
      preferredCanonicalPath && !ownsCanonicalLink
        ? [
            {
              rel: 'canonical',
              href: canonicalUrl(preferredCanonicalPath, canonicalSearch),
            },
          ]
        : [],
    meta: [
      ...(!ownsCanonicalLink
        ? [
            { property: 'og:url', content: pageUrl },
            { name: 'twitter:url', content: pageUrl },
          ]
        : []),
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
  ...consentLoaderOptions,
  loader: async () => {
    return {
      partnerPlacementSessionSeed: createPartnerPlacementSessionSeed(),
      consent: await getConsentState(),
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
        // Bricolage Grotesque (display) and IBM Plex Mono (code) are
        // self-hosted in src/styles/app.css without a preload. Measured on
        // throttled mobile, preloading Bricolage delayed first paint by about
        // 250 ms and still arrived after it.
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon-light.svg',
          media: '(prefers-color-scheme: light)',
        },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon-dark.svg',
          media: '(prefers-color-scheme: dark)',
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
        {
          rel: 'manifest',
          href: matches.some(
            (match) =>
              match.pathname === '/chat' || match.pathname.startsWith('/chat/'),
          )
            ? '/chat/manifest.webmanifest'
            : '/site.webmanifest',
        },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    }
  },
  headers: () => DOCUMENT_CACHE_HEADERS,
  staleTime: Infinity,
  shellComponent: ShellComponent,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
})

function ShellComponent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { queryClient } = Route.useRouteContext()
  const { consent } = Route.useLoaderData()
  const hasBaseParent = useMatches({
    select: (matches) => matches.find((d) => d.staticData?.baseParent),
  })

  const isNavigating = useRouterState({
    select: (s) => s.status === 'pending',
  })
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
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
  const hideFooter =
    pathname === '/builder' ||
    pathname.startsWith('/builder/') ||
    pathname === '/chat' ||
    pathname.startsWith('/chat/')

  const htmlClass = useHtmlClass()
  const routeContent = (
    <BuilderRouteFrame pathname={pathname}>
      <React.Suspense fallback={<BuilderRouteSkeleton pathname={pathname} />}>
        {children}
      </React.Suspense>
    </BuilderRouteFrame>
  )

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
        <RouterContextProvider router={router}>
          <ConsentRoot
            state={consent}
            scripts={consentScripts}
            options={CONSENT_UI_OPTIONS}
          >
            <QueryClientProvider client={queryClient}>
              <ThemeProvider>
                <SearchProvider
                  enabled={
                    pathname !== '/chat' && !pathname.startsWith('/chat/')
                  }
                >
                  <LoginModalProvider>
                    <ToastProvider>
                      <PageViewTracker />
                      <ProductScarf />
                      <LibrariesOverlayProvider>
                        {hideNavbar ? (
                          routeContent
                        ) : (
                          <Navbar>
                            {routeContent}
                            {hideFooter ? null : <Footer />}
                          </Navbar>
                        )}
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
                          {isNavigating && showNavigationSpinner ? (
                            <Spinner className="text-4xl" />
                          ) : null}
                        </div>
                      </div>
                    </ToastProvider>
                  </LoginModalProvider>
                </SearchProvider>
              </ThemeProvider>
            </QueryClientProvider>
            {/* Embeds render inside other sites' iframes; keep them clear. */}
            {hasBaseParent ? null : (
              <ConsentBanner
                variant={pathname === '/' ? 'bar' : 'floating'}
                // Accept and Reject carry equal weight under the policy.
                primaryButton={['accept', 'reject']}
              />
            )}
            <ConsentDialog />
          </ConsentRoot>
          <Scripts />
        </RouterContextProvider>
      </body>
    </html>
  )
}

/**
 * The single source of `page_view` events: one on initial load and one per
 * SPA navigation. gtag config runs with `send_page_view: false`, and GA4's
 * enhanced-measurement "page changes based on browser history events" must
 * stay disabled on the web stream, or navigations are counted twice.
 */
function PageViewTracker() {
  const pagePath = useRouterState({
    select: (s) => {
      if (!s.resolvedLocation) {
        return null
      }

      const pathname = s.resolvedLocation.pathname || '/'
      const search = s.resolvedLocation.searchStr || ''

      return `${pathname}${search}`
    },
  })
  const lastTrackedPath = React.useRef<string | null>(null)

  React.useEffect(() => {
    const stopTrackingHoverIntent = trackScarfExternalLinkHoverIntent()
    document.addEventListener('click', trackScarfExternalLinkClick, true)
    document.addEventListener('click', trackScarfDownloadClick, true)
    document.addEventListener('copy', trackScarfClipboardEvent, true)
    document.addEventListener('paste', trackScarfClipboardEvent, true)
    return () => {
      stopTrackingHoverIntent()
      document.removeEventListener('click', trackScarfExternalLinkClick, true)
      document.removeEventListener('click', trackScarfDownloadClick, true)
      document.removeEventListener('copy', trackScarfClipboardEvent, true)
      document.removeEventListener('paste', trackScarfClipboardEvent, true)
    }
  }, [])

  React.useEffect(() => {
    // Skip until the router has resolved a location, and never send the same
    // path twice in a row (guards against the location resolving twice).
    if (pagePath === null || lastTrackedPath.current === pagePath) {
      return
    }

    lastTrackedPath.current = pagePath
    trackPageView(pagePath)
    trackScarfPageView(window.location.pathname)
  }, [pagePath])

  return null
}
