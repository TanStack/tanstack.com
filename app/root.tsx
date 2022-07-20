import * as React from 'react'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useCatch,
  LinksFunction,
  useMatches,
  MetaFunction,
  useTransition,
  LoaderFunction,
} from '@remix-run/react'

import styles from './styles/app.generated.css'
import prismThemeLight from './styles/prismThemeLight.css'
import prismThemeDark from './styles/prismThemeDark.css'
import docsearchCss from '@docsearch/css/dist/style.css'
import { CgSpinner } from 'react-icons/cg'

import { seo } from './utils/seo'

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

export let links: LinksFunction = () => {
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
      href: docsearchCss,
    },
    {
      rel: 'stylesheet',
      href: require('./styles/carbon.css'),
    },
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
  const transition = useTransition()
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
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
        <div
          className={`absolute top-2 left-1/2 -translate-1/2 p-2 bg-white dark:bg-gray-800
          rounded-lg shadow-lg transition-opacity duration-300 hover:opacity-0 pointer-events-none
          z-30 delay-300 ${
            transition.state !== 'idle' ? 'opacity-1' : 'opacity-0'
          }`}
        >
          <CgSpinner className="animate-spin text-2xl" />
        </div>
      </body>
    </html>
  )
}

export function CatchBoundary() {
  let caught = useCatch()

  let message
  switch (caught.status) {
    case 401:
      message = (
        <p>
          Oops! Looks like you tried to visit a page that you do not have access
          to.
        </p>
      )
      break
    case 404:
      message = (
        <p>Oops! Looks like you tried to visit a page that does not exist.</p>
      )
      break

    default:
      throw new Error(caught.data || caught.statusText)
  }

  return (
    <Document title={`${caught.status} ${caught.statusText}`}>
      <h1>
        {caught.status}: {caught.statusText}
      </h1>
      {message}
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
