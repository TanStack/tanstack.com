// Local module augmentation to add server property to file routes
// This mirrors @tanstack/start-client-core/serverRoute but is local to ensure it's loaded

import type { AnyRoute, AnyContext } from '@tanstack/router-core'

declare module '@tanstack/router-core' {
  interface FilebaseRouteOptionsInterface<
    TRegister,
    TParentRoute extends AnyRoute,
    TId extends string,
    TPath extends string,
    TSearchValidator,
    TParams,
    TLoaderDeps extends Record<string, any>,
    TLoaderFn,
    TRouterContext,
    TRouteContextFn,
    TBeforeLoadFn,
    TRemountDepsFn,
    TSSR,
    TServerMiddlewares,
    THandlers,
  > {
    server?: {
      middleware?: unknown
      handlers?:
        | Record<
            | 'ANY'
            | 'GET'
            | 'POST'
            | 'PUT'
            | 'PATCH'
            | 'DELETE'
            | 'OPTIONS'
            | 'HEAD',
            (ctx: {
              request: Request
              params: TParams
              pathname: string
              context?: unknown
              next?: <TContext = undefined>(options?: {
                context?: TContext
              }) => {
                isNext: true
                context: TContext
              }
            }) => Response | Promise<Response> | undefined | Promise<undefined>
          >
        | ((opts: unknown) => Record<string, unknown>)
    }
  }
}
