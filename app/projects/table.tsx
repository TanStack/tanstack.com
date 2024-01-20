import { useRouteLoaderData } from '@remix-run/react'
import type { TableConfigLoaderData } from '~/routes/table.v8'

export const repo = 'tanstack/table'

export const v8branch = 'main'

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600'

export const useReactTableV8Config = () => {
  const tableConfigLoaderData =
    useRouteLoaderData<TableConfigLoaderData>('routes/table.v8')
  if (!tableConfigLoaderData?.tanstackDocsConfig) {
    throw new Error('Config could not be read for tanstack/table!')
  }

  return tableConfigLoaderData.tanstackDocsConfig
}
