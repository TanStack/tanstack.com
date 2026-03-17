import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'
import { QueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/tanstackstart-react'

export function getRouter() {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  })

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    scrollRestoration: true,
    defaultStaleTime: 1,
    defaultNotFoundComponent: () => {
      return <NotFound />
    },
    context: {
      queryClient,
    },
    scrollToTopSelectors: ['.scroll-to-top'],
  })
  setupRouterSsrQueryIntegration({ router, queryClient })

  if (!router.isServer) {
    Sentry.init({
      dsn: 'https://ac4bfc43ff4a892f8dc7053c4a50d92f@o4507236158537728.ingest.us.sentry.io/4507236163649536',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      sendDefaultPii: true,
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ['localhost', /^https:\/\/tanstack\.com\//],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
      beforeSend(event, hint) {
        // Filter out third-party ad script errors that are unactionable.
        // These originate from Publift Fuse (ftUtils.js / fuseplatform.net)
        // attempting cross-frame document access and are not bugs in tanstack.com.
        const error = hint.originalException
        const errorMessage =
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : ''

        const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
        const hasAdScriptFrame = frames.some((frame) => {
          const filename = frame.filename ?? ''
          return (
            filename.includes('fuseplatform.net') ||
            filename.includes('fuse.js') ||
            filename.includes('ftUtils.js') ||
            filename.includes('/media/native/') ||
            filename.includes('/nobid/blocking_script.js')
          )
        })

        const hasExpectedErrorMessage =
          errorMessage.includes('contextWindow.parent') ||
          errorMessage.includes('null is not an object') ||
          errorMessage.includes('Cannot read properties of null') ||
          errorMessage.includes('is not a function')

        if (hasAdScriptFrame && hasExpectedErrorMessage) {
          return null
        }

        return event
      },
    })
  }

  return router
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    baseParent?: boolean
    Title?: () => any
    showNavbar?: boolean
  }
}

declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
