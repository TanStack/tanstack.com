import { createRouter as TanStackCreateRouter } from '@tanstack/react-router'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'
import { QueryClient } from '@tanstack/react-query'
import { GamOnPageChange } from './components/Gam'
import { env } from './utils/env'

export function createRouter() {
  const CONVEX_URL = env.VITE_CONVEX_URL
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })

  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    TanStackCreateRouter({
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
        convexClient: convexQueryClient.convexClient,
        convexQueryClient,
      },
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          {children}
        </ConvexProvider>
      ),
    }),
    queryClient
  )

  let firstRender = true

  router.subscribe('onResolved', () => {
    if (firstRender) {
      firstRender = false
      return
    }

    console.log('onResolved')
    GamOnPageChange()
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
  interface StaticDataRouteOption {
    baseParent?: boolean
  }
}
