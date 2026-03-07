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
      beforeSend(event, hint) {
        // Filter out Publift Fuse and ad script errors that are expected
        // These errors occur in iOS Safari and during navigation due to strict Same-Origin Policy
        // and race conditions with ad script initialization
        const error = hint.originalException
        const errorMessage =
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : ''

        // Check if this is an ad script error we want to suppress
        const frames = event.exception?.values?.[0]?.stacktrace?.frames || []

        // More robust filename checking - check all frames for ad script patterns
        const hasAdScriptFrame =
          frames.length > 0 &&
          frames.some((frame) => {
            const filename = frame.filename || ''
            // Normalize filename to handle both absolute URLs and relative paths
            const normalizedFilename = filename.toLowerCase()
            return (
              normalizedFilename.includes('/media/native/') ||
              normalizedFilename.includes('fuse.js') ||
              normalizedFilename.includes('fuseplatform.net') ||
              normalizedFilename.includes('/nobid/blocking_script.js') ||
              normalizedFilename.includes('blocking_script.js') ||
              // Check function name patterns from nobid script
              frame.function === 'BQ' ||
              frame.function === 'Navigation.<anonymous>'
            )
          })

        // Check for specific error messages from ad scripts
        const hasExpectedErrorMessage =
          errorMessage.includes('contextWindow.parent') ||
          errorMessage.includes('null is not an object') ||
          errorMessage.includes('is not a function') ||
          // Specific nobid script errors
          errorMessage.includes('tG is not a function') ||
          errorMessage.includes('KShg7B3')

        if (hasAdScriptFrame && hasExpectedErrorMessage) {
          // Suppress the error - log to console in debug mode
          console.debug(
            'Suppressed Publift Fuse/ad script error:',
            errorMessage,
            'Frame:',
            frames[0]?.filename,
            'Function:',
            frames[0]?.function,
          )
          return null // Don't send to Sentry
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
