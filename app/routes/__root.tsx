import * as React from 'react'
import {
  Outlet,
  ScrollRestoration,
  createRootRouteWithContext,
  redirect,
  useMatches,
  useRouterState,
} from '@tanstack/react-router'
import appCss from '~/styles/app.css?url'
import carbonStyles from '~/styles/carbon.css?url'
import { seo } from '~/utils/seo'
import ogImage from '~/images/og.png'
import { Meta, RouterManagedTag, Scripts } from '@tanstack/react-router-server'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { NotFound } from '~/components/NotFound'
import { CgSpinner } from 'react-icons/cg'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { useScript } from '~/hooks/useScript'

let HydrationOverlay = ({ children }: { children: React.ReactNode }) => children

if (import.meta.env.NODE_ENV === 'development') {
  HydrationOverlay = React.lazy(() =>
    import('@builder.io/react-hydration-overlay').then((d) => ({
      default: d.HydrationOverlay,
    }))
  )
}

export const Route = createRootRouteWithContext<{
  assets: RouterManagedTag[]
}>()({
  meta: () => [
    {
      charSet: 'utf-8',
    },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    },
    ...seo({
      title: 'TanStack | High Quality Open-Source Software for Web Developers',
      description: `Headless, type-safe, powerful utilities for complex workflows like Data Management, Data Visualization, Charts, Tables, and UI Components.`,
      image: ogImage,
      keywords:
        'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software',
    }),
  ],
  links: () => [
    { rel: 'stylesheet', href: appCss },
    {
      rel: 'stylesheet',
      href: carbonStyles,
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: '/favicons/apple-touch-icon.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/favicons/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      href: '/favicons/favicon-16x16.png',
    },
    { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
    { rel: 'icon', href: '/favicon.ico' },
  ],
  scripts: () => [
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
    {
      children: `
      function setDocumentDarkMode(isDark) {
        if (isDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }

      try {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)')?.matches;
        setDocumentDarkMode(isDark)
      } catch (e) {}

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        setDocumentDarkMode(event.matches)
      });
      `,
    },
  ],
  loader: async (ctx) => {
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
  errorComponent: ({ error }) => {
    return (
      <RootDocument title="Error!">
        <DefaultCatchBoundary
          error={error}
          info={{
            componentStack: '',
          }}
          reset={undefined as any}
        />
      </RootDocument>
    )
  },
  notFoundComponent: () => {
    return (
      <RootDocument title="404 Not Found">
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

function RootDocument({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const matches = useMatches()

  const isLoading = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  })

  useScript({
    id: 'hs-script-loader',
    async: true,
    defer: true,
    src: '//js-na1.hs-scripts.com/45982155.js',
  })

  return (
    <html lang="en" data-theme="dark">
      <head>
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        {title ? <title>{title}</title> : null}
        <Meta />
      </head>
      <body>
        <HydrationOverlay>
          {children}
          <TanStackRouterDevtools position="bottom-right" />
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
        </HydrationOverlay>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
