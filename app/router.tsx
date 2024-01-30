import { CatchBoundary, ErrorComponent, Router } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'

export function createRouter() {
  return new Router({
    routeTree,
    defaultPreload: 'intent',
    context: {
      assets: null as any, // We'll fulfill this later
    },
    defaultErrorComponent: DefaultCatchBoundary,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
  interface StaticDataRouteOption {
    baseParent?: boolean
  }
}
