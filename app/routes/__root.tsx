import * as React from 'react'
import {
  Outlet,
  ScriptOnce,
  createRootRouteWithContext,
  redirect,
  useMatches,
  useRouterState,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import carbonStyles from '~/styles/carbon.css?url'
import { seo } from '~/utils/seo'
import ogImage from '~/images/og.png'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { NotFound } from '~/components/NotFound'
import { CgSpinner } from 'react-icons/cg'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { twMerge } from 'tailwind-merge'
import { getThemeCookie, useThemeStore } from '~/components/ThemeToggle'
import { useMounted } from '~/hooks/useMounted'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { GoogleScripts } from '~/components/GoogleScripts'

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
      {
        name: 'google-adsense-account',
        content: 'ca-pub-9403278435468733',
      },
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
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: '' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
      },
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

  const themeClass = themeCookie === 'dark' ? 'dark' : ''

  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  React.useEffect(() => {
    if (prefersReducedMotion !== false) {
      return
    }

    const canvas = canvasRef.current

    const morphDuration = 4000
    const waitDuration = 1000 * 60 * 2

    function easeInOutCubic(t: number, b: number, c: number, d: number) {
      if ((t /= d / 2) < 1) return (c / 2) * t * t * t + b
      return (c / 2) * ((t -= 2) * t * t + 2) + b
    }

    if (canvas) {
      const ctx = canvas.getContext('2d')!

      let rafId: ReturnType<typeof requestAnimationFrame> | null = null
      let timeout: ReturnType<typeof setTimeout> | null = null
      let startTime = performance.now()

      function createBlobs() {
        return shuffle([
          {
            color: { h: 10, s: 100, l: 50 },
          },
          {
            color: { h: 40, s: 100, l: 50 },
          },
          {
            color: { h: 150, s: 100, l: 50 },
          },
          {
            color: { h: 200, s: 100, l: 50 },
          },
        ]).map((blob) => ({
          ...blob,
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          r: Math.random() * 500 + 700,
          colorH: blob.color.h,
          colorS: blob.color.s,
          colorL: blob.color.l,
        }))
      }

      function shuffle<T>(array: T[]) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[array[i], array[j]] = [array[j], array[i]]
        }
        return array
      }

      let currentBlobs = createBlobs()
      let interBlobs = currentBlobs
      let targetBlobs: ReturnType<typeof createBlobs> = []

      function start() {
        if (timeout) {
          clearTimeout(timeout)
        }
        if (rafId) {
          cancelAnimationFrame(rafId)
        }
        const parent = canvas!.parentElement
        canvas!.width = parent!.clientWidth
        canvas!.height = parent!.clientHeight

        currentBlobs = interBlobs
        targetBlobs = createBlobs()
        startTime = performance.now()
        animate()
      }

      function animate() {
        ctx.clearRect(0, 0, canvas!.width, canvas!.height)

        const time = performance.now() - startTime
        const progress = easeInOutCubic(time, 0, 1, morphDuration)

        // Draw the blobs
        currentBlobs.forEach((blob, i) => {
          const targetBlob = targetBlobs[i]
          interBlobs[i].x = blob.x + (targetBlob.x - blob.x) * progress
          interBlobs[i].y = blob.y + (targetBlob.y - blob.y) * progress

          const gradient = ctx.createRadialGradient(
            interBlobs[i].x,
            interBlobs[i].y,
            0,
            interBlobs[i].x,
            interBlobs[i].y,
            interBlobs[i].r
          )

          interBlobs[i].colorH =
            blob.colorH + (targetBlob.colorH - blob.colorH) * progress
          interBlobs[i].colorS =
            blob.colorS + (targetBlob.colorS - blob.colorS) * progress
          interBlobs[i].colorL =
            blob.colorL + (targetBlob.colorL - blob.colorL) * progress

          gradient.addColorStop(
            0,
            `hsla(${interBlobs[i].colorH}, ${interBlobs[i].colorS}%, ${interBlobs[i].colorL}%, 1)`
          )
          gradient.addColorStop(
            1,
            `hsla(${interBlobs[i].colorH}, ${interBlobs[i].colorS}%, ${interBlobs[i].colorL}%, 0)`
          )

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(
            interBlobs[i].x,
            interBlobs[i].y,
            interBlobs[i].r,
            0,
            Math.PI * 2
          )
          ctx.fill()
        })

        if (progress < 1) {
          rafId = requestAnimationFrame(animate)
        } else {
          timeout = setTimeout(() => {
            start()
          }, waitDuration)
        }
      }

      start()
      window.addEventListener('resize', start)

      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId)
        }
        if (timeout) {
          clearTimeout(timeout)
        }
        window.removeEventListener('resize', start)
      }
    }
  }, [prefersReducedMotion])

  const isHomePage = useRouterState({
    select: (s) => s.location.pathname === '/',
  })

  const mounted = useMounted()

  return (
    <html lang="en" className={themeClass}>
      <head>
        {/* If the theme is set to auto, inject a tiny script to set the proper class on html based on the user preference */}
        {themeCookie === 'auto' ? (
          <ScriptOnce
            children={`window.matchMedia('(prefers-color-scheme: dark)').matches ? document.documentElement.classList.add('dark') : null`}
          />
        ) : null}
        <HeadContent />
        {matches.find((d) => d.staticData?.baseParent) ? (
          <base target="_parent" />
        ) : null}
        <GoogleScripts />
      </head>
      <body>
        <div
          className={twMerge(
            'fixed inset-0 z-0 opacity-20 pointer-events-none',
            'transition-opacity duration-[2s] ease-linear',
            `[&+*]:relative`,
            mounted
              ? isHomePage
                ? 'opacity-10 dark:opacity-20'
                : 'opacity-10 dark:opacity-20'
              : 'opacity-0'
          )}
        >
          <canvas ref={canvasRef} />
        </div>
        <React.Suspense fallback={null}>{children}</React.Suspense>
        {showDevtools ? (
          <TanStackRouterDevtools position="bottom-right" />
        ) : null}
        {canShowLoading ? (
          <div
            className={`fixed top-0 left-0 h-[300px] w-full
        transition-all duration-300 pointer-events-none
        z-30 dark:h-[200px] dark:!bg-white/10 dark:rounded-[100%] ${
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
              <CgSpinner className="text-3xl animate-spin" />
            </div>
          </div>
        ) : null}
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
