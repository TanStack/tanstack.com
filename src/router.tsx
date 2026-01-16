import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'
import { QueryClient } from '@tanstack/react-query'
import { GamOnPageChange } from './components/Gam'
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

  let firstRender = true

  router.subscribe('onResolved', () => {
    if (firstRender) {
      firstRender = false
      return
    }

    GamOnPageChange()
  })

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
      // Filter out third-party ad script errors (Publift Fuse and NoBid)
      beforeSend(event, hint) {
        const error = hint.originalException

        // Check if error is from third-party ad scripts
        const isAdScriptError = event.exception?.values?.some((exception) => {
          const frames = exception.stacktrace?.frames || []

          // Check if any frame in the stack trace is from ad scripts
          const hasAdScriptFrame = frames.some((frame) => {
            const filename = frame.filename || ''
            return (
              filename.includes('/media/native/') ||
              filename.includes('fuse.js') ||
              filename.includes('fuseplatform.net') ||
              filename.includes('/nobid/blocking_script.js')
            )
          })

          // Check if error message matches known patterns
          const errorMessage = exception.value || ''
          const hasKnownErrorPattern =
            errorMessage.includes('contextWindow.parent') ||
            errorMessage.includes('null is not an object') ||
            errorMessage.includes('is not a function')

          return hasAdScriptFrame && hasKnownErrorPattern
        })

        // Also check the error object directly if available
        const isAdScriptErrorFromHint =
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string' &&
          (error.message.includes('contextWindow.parent') ||
            error.message.includes('null is not an object') ||
            error.message.includes('is not a function'))

        // Drop the event if it's from ad scripts
        if (isAdScriptError || isAdScriptErrorFromHint) {
          console.debug('Filtered out ad script error from Sentry:', event)
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
