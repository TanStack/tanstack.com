import * as React from 'react'
import {
  Links,
  LiveReload,
  Meta,
  Scripts,
  ScrollRestoration,
  useMatches,
  useNavigation,
} from '@remix-run/react'
import { CgSpinner } from 'react-icons/cg'

export function RootDocument({
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
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  