import './utils/promise-with-resolvers'

import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'
import { QueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/tanstackstart-react'

function deferSentryReplayIntegration() {
  if (typeof window === 'undefined') {
    return
  }

  const loadReplay = async () => {
    try {
      const client = Sentry.getClient()

      if (client?.getIntegrationByName('Replay')) {
        return
      }

      const { replayIntegration } = await import('@sentry/browser')

      Sentry.getClient()?.addIntegration(replayIntegration())
    } catch {
      // Ignore replay load failures and preserve core error reporting.
    }
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(
      () => {
        void loadReplay()
      },
      { timeout: 2500 },
    )
    return
  }

  globalThis.setTimeout(() => {
    void loadReplay()
  }, 2500)
}

if (typeof document !== 'undefined') {
  Sentry.init({
    dsn: 'https://ac4bfc43ff4a892f8dc7053c4a50d92f@o4507236158537728.ingest.us.sentry.io/4507236163649536',
    sendDefaultPii: true,
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ['localhost', /^https:\/\/tanstack\.com\//],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    beforeSend(event) {
      // Filter out errors from third-party ad tech scripts (e.g. Publift's
      // Fuse Platform ftUtils.js) that are not actionable by us.
      const frames = event.exception?.values?.flatMap(
        (v) => v.stacktrace?.frames ?? [],
      )
      if (
        frames &&
        frames.length > 0 &&
        frames.every((frame) => {
          const filename = frame.filename ?? ''
          return (
            filename.includes('ftUtils.js') ||
            filename.includes('fuseplatform.net')
          )
        })
      ) {
        return null
      }
      return event
    },
  })

  deferSentryReplayIntegration()
}

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

  if (!router.isServer) {
    Sentry.addIntegration(
      Sentry.tanstackRouterBrowserTracingIntegration(router),
    )
  }

  setupRouterSsrQueryIntegration({ router, queryClient })

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
