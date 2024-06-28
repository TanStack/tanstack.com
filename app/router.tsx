import { createRouter as TanStackCreateRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'

export function createRouter() {
  const router = TanStackCreateRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultStaleTime: 1,
    defaultNotFoundComponent: () => {
      return <NotFound />
    },
    context: {
      assets: [],
    },
  })

  router.subscribe('onResolved', () => {
    try {
      ;(window as any)._carbonads?.refresh?.()
      document.querySelectorAll('[id^="carbonads_"]').forEach((el, i) => {
        if (i > 0) {
          el.remove()
        }
      })
    } catch {}
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
