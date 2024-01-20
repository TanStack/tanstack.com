import { useRouteLoaderData } from '@remix-run/react'
import type { RouterConfigLoaderData } from '~/routes/router.v1'

export const repo = 'tanstack/router'

export const v1branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500'

export const useRouterV1Config = () => {
  const routerConfigLoaderData =
    useRouteLoaderData<RouterConfigLoaderData>('routes/router.v1')
  if (!routerConfigLoaderData?.tanstackDocsConfig) {
    throw new Error('Config could not be read for tanstack/router!')
  }

  return routerConfigLoaderData.tanstackDocsConfig
}
