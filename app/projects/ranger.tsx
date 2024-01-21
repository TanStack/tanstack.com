import { useRouteLoaderData } from '@remix-run/react'
import type { RangerConfigV1Loader } from '~/routes/ranger.v1.docs'

export const repo = 'tanstack/ranger'

export const v1branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500'

export const useRangerV1Config = () => {
  const rangerConfigLoaderData = useRouteLoaderData<RangerConfigV1Loader>(
    'routes/ranger.v1.docs'
  )

  if (!rangerConfigLoaderData?.tanstackDocsConfig) {
    throw new Error(`Config could not be read for ${repo}!`)
  }

  return rangerConfigLoaderData.tanstackDocsConfig
}
