import * as React from 'react'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useCatch,
  useMatches,
  useNavigation,
} from '@remix-run/react'
import type { LinksFunction, MetaFunction } from '@remix-run/node'

import styles from './styles/app.generated.css'
import prismThemeLight from './styles/prismThemeLight.css'
import prismThemeDark from './styles/prismThemeDark.css'
import docSearchStyles from '@docsearch/css/dist/style.css'
import { CgSpinner } from 'react-icons/cg'

import { seo } from './utils/seo'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  viewport: 'width=device-width,initial-scale=1',
  ...seo({
    title: 'TanStack | High Quality Open-Source Software for Web Developers',
    description: `Headless, type-safe, powerful utilities for complex workflows like Data Management, Data Visualization, Charts, Tables, and UI Components.`,
    image: require('./images/og.png'),
    keywords:
      'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software',
  }),
})

export const links: LinksFunction = () => {
  return [
    { rel: 'stylesheet', href: styles },
    {
      rel: 'stylesheet',
      href: prismThemeLight,
      media: '(prefers-color-scheme: light)',
    },
    {
      rel: 'stylesheet',
      href: prismThemeDark,
      media: '(prefers-color-scheme: dark)',
    },
    {
      rel: 'stylesheet',
      href: docSearchStyles,
    },
    {
      rel: 'stylesheet',
      href: require('./styles/carbon.css'),
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
  ]
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  )
}

function Document({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const navigation = useNavigation()
  const matches = useMatches()
  // const styles = useStylesLink()

  return (
    // <html lang="en" className={cx(getGlobalStyles())}>
    <html lang="en">
      <head>
        {/* {styles} */}
        {matches.find((d) => d.handle?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        {title ? <title>{title}</title> : null}
        <Meta />
        <Links />
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-JMT1Z50SPS"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-JMT1Z50SPS');
            `,
          }}
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (matchMedia("(prefers-color-scheme: dark)").matches) {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.removeAttribute('data-theme');
                }
              } catch (error) {}
            `,
          }}
        ></script>
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <div
          className={`absolute top-2 left-1/2 -translate-1/2 p-2 bg-white dark:bg-gray-800
          rounded-lg shadow-lg transition-opacity duration-300 hover:opacity-0 pointer-events-none
          z-30 delay-300 ${
            navigation.state !== 'idle' ? 'opacity-1' : 'opacity-0'
          }`}
        >
          <CgSpinner className="text-2xl animate-spin" />
        </div>
      </body>
    </html>
  )
}

export function CatchBoundary() {
  let caught = useCatch()

  return (
    <Document title={`${caught.status} ${caught.statusText}`}>
      <div className="h-[50vh] flex flex-col items-center justify-center gap-6">
        <DefaultCatchBoundary isRoot />
      </div>
    </Document>
  )
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error)
  return (
    <Document title="Error!">
      <div>
        <h1>There was an error!</h1>
        <p>{error.message}</p>
      </div>
    </Document>
  )
}
