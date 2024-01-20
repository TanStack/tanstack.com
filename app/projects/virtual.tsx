import { useRouteLoaderData } from '@remix-run/react'
import type { VirtualConfigLoaderData } from '~/routes/virtual.v3'

export const repo = 'tanstack/virtual'

export const v3branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-600'

export const useVirtualV3Config = () => {
  const virtualConfigData =
    useRouteLoaderData<VirtualConfigLoaderData>('routes/virtual.v3')
  if (!virtualConfigData?.tanstackDocsConfig) {
    throw new Error('Config could not be read for tanstack/virtual!')
  }

  return virtualConfigData.tanstackDocsConfig
}
