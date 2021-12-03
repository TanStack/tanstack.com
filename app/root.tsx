import * as React from 'react'
import { tw } from 'twind'
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
} from 'remix'
import { getGlobalStyles } from './styles/global'

export let links: LinksFunction = () => {
  return [
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
  const matches = useMatches()

  return (
    <html lang="en" className={tw(getGlobalStyles())}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {matches.find((d) => d.handle?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        {title ? <title>{title}</title> : null}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        {/* Hubspot */}
        <script
          src="https://js.hs-scripts.com/8180418.js"
          id="hs-script-loader"
        />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
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
