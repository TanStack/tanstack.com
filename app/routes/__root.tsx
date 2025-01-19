import * as React from 'react'
import {
  Outlet,
  ScriptOnce,
  ScrollRestoration,
  createRootRouteWithContext,
  redirect,
  useMatches,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import carbonStyles from '~/styles/carbon.css?url'
import { seo } from '~/utils/seo'
import ogImage from '~/images/og.png'
import { Scripts, Meta } from '@tanstack/start'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { NotFound } from '~/components/NotFound'
import { CgSpinner } from 'react-icons/cg'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { twMerge } from 'tailwind-merge'
import { getThemeCookie, useThemeStore } from '~/components/ThemeToggle'
import { useMounted } from '~/hooks/useMounted'

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
        rel: 'stylesheet',
        href: carbonStyles,
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
    ],
  }),
  beforeLoad: async (ctx) => {
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
  staleTime: Infinity,
  loader: async () => {
    return {
      themeCookie: await getThemeCookie(),
    }
  },
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },
  notFoundComponent: () => {
    return (
      <RootDocument>
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

function RootDocument({ children }: { children: React.ReactNode }) {
  const { themeCookie } = Route.useLoaderData()

  React.useEffect(() => {
    useThemeStore.setState({ mode: themeCookie })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const matches = useMatches()

  const isLoading = useRouterState({
    select: (s) => s.status === 'pending',
  })

  const [showLoading, setShowLoading] = React.useState(false)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setShowLoading(true)
    }, 2000)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  const isRouterPage = useRouterState({
    select: (s) => s.resolvedLocation.pathname.startsWith('/router'),
  })

  const showDevtools = showLoading && isRouterPage

  const themeClass = themeCookie === 'dark' ? 'dark' : ''

  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current

    if (canvas) {
      const ctx = canvas.getContext('2d')!

      // Resize canvas to fill the window
      function resizeCanvas() {
        const parent = canvas!.parentElement
        canvas!.width = parent!.clientWidth
        canvas!.height = parent!.clientHeight
      }

      resizeCanvas()

      window.addEventListener('resize', resizeCanvas)

      // Configuration for gradient blobs
      const blobs = [
        {
          direction: [Math.random() * 1, Math.random() * 1],
          color: { h: 184, s: 100, l: 66 }, // turquoise from logo sky (higher luminance)
        },
        {
          direction: [Math.random() * 1, Math.random() * 1],
          color: { h: 42, s: 100, l: 66 }, // orange from logo sun (higher luminance)
        },
        {
          direction: [Math.random() * 1, Math.random() * 1],
          color: { h: 341, s: 94, l: 66 }, // red from logo sunchair (higher luminance)
        },
        {
          direction: [Math.random() * 1, Math.random() * 1],
          color: { h: 184, s: 100, l: 66 }, // turquoise from logo sky (higher luminance) (second instance)
        },
        {
          direction: [Math.random() * 1, Math.random() * 1],
          color: { h: 42, s: 100, l: 66 }, // orange from logo sun (higher luminance) (second instance)
        },
        {
          direction: [Math.random() * 1, Math.random() * 1],
          color: { h: 341, s: 94, l: 66 }, // red from logo sunchair (higher luminance) (second instance)
        },
      ].map((blob, i) => ({
        ...blob,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * Math.random() * canvas.height + 150,
        colorH: blob.color.h,
        colorS: blob.color.s,
        colorL: blob.color.l,
        colorA: 1,
      }))

      const movementSpeed = 0.5

      // Animate the blobs
      function animate() {
        ctx.clearRect(0, 0, canvas!.width, canvas!.height)

        // Manage blob existing
        ;[...blobs].forEach((blob, i) => {
          // If the blob is going to be outside the canvas, bounce it's direction
          if (blob.x < 0 || blob.x > canvas!.width) {
            blob.direction[0] = -blob.direction[0]
          }
          if (blob.y < 0 || blob.y > canvas!.height) {
            blob.direction[1] = -blob.direction[1]
          }
        })

        blobs.forEach((blob, i) => {
          blob.x += blob.direction[0] * movementSpeed
          blob.y += blob.direction[1] * movementSpeed

          // Create radial gradient
          const gradient = ctx.createRadialGradient(
            blob.x,
            blob.y,
            0,
            blob.x,
            blob.y,
            blob.r
          )

          gradient.addColorStop(
            0,
            `hsla(${blob.colorH}, ${blob.colorS}%, ${blob.colorL}%, ${blob.colorA})`
          )
          gradient.addColorStop(
            1,
            `hsla(${blob.colorH}, ${blob.colorS}%, ${blob.colorL}%, 0)`
          )

          // Draw gradient
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2)
          ctx.fill()
        })

        const id = requestAnimationFrame(animate)

        return () => {
          cancelAnimationFrame(id)
        }
      }

      return animate()
    }
  }, [])

  // const isHomePage = useRouterState({
  //   select: (s) => s.location.pathname === '/',
  // })

  // const mounted = useMounted()

  return (
    <html lang="en" className={themeClass}>
      <head>
        {/* If the theme is set to auto, inject a tiny script to set the proper class on html based on the user preference */}
        {themeCookie === 'auto' ? (
          <ScriptOnce
            children={`window.matchMedia('(prefers-color-scheme: dark)').matches ? document.documentElement.classList.add('dark') : null`}
          />
        ) : null}
        <Meta />
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
      </head>
      <body>
        <div
          id="animated-background-canvas-container"
          className={twMerge(
            'fixed inset-0 z-0 opacity-20 pointer-events-none',
            'transition-opacity duration-[2s] ease-linear',
            `[&+*]:relative`
          )}
        >
          <canvas ref={canvasRef} />
        </div>
        <React.Suspense fallback={null}>{children}</React.Suspense>
        {showDevtools ? (
          <TanStackRouterDevtools position="bottom-right" />
        ) : null}
        {showLoading ? (
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
        ) : null}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// export function Html({ children, ...props }: React.HTMLProps<HTMLHtmlElement>) {
//   const router = useRouter()

//   // warning(
//   //   !Object.keys(props).length,
//   //   'Passing props other than children to the Html component will be supported very soon in React 19.',
//   // )

//   if (!router.isServer) {
//     return <>{children}</>
//   }

//   return <html>{children}</html>
// }

// export function Head({ children, ...props }: React.HTMLProps<HTMLHeadElement>) {
//   const router = useRouter()

//   // warning(
//   //   !Object.keys(props).length,
//   //   'Passing props other than children to the Head component will be supported very soon in React 19.',
//   // )

//   if (!router.isServer) {
//     return children
//   }

//   return <head>{children}</head>
// }

// export function Body({ children, ...props }: React.HTMLProps<HTMLBodyElement>) {
//   const router = useRouter()

//   // warning(
//   //   !Object.keys(props).length,
//   //   'Passing props other than children to the Body component will be supported very soon in React 19.',
//   // )

//   if (!router.isServer) {
//     return children
//   }

//   return <body>{children}</body>
// }
