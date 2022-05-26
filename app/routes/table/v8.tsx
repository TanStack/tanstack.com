import { json, LoaderFunction, Outlet } from 'remix'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { fetchRepoFile } from '~/utils/docCache.server'
import { useMatchesData } from '~/utils/utils'

export type V8Config = {
  docSearch: {
    appId: string
    indexName: string
    apiKey: string
  }
  menu: {
    label: string
    children: {
      label: string
      to: string
    }[]
  }[]
}

export const v8branch = 'alpha'

export const loader: LoaderFunction = async () => {
  const config = await fetchRepoFile(
    'tanstack/react-table/',
    v8branch,
    `docs/config.json`
  )

  const parsedConfig = JSON.parse(config ?? '')

  if (!parsedConfig) {
    throw new Error('Repo docs/config.json not found!')
  }

  return json(parsedConfig)
}

export const ErrorBoundary = DefaultErrorBoundary

export const useReactTableV8Config = () =>
  useMatchesData('/table/v8') as V8Config

export default function RouteReactTable() {
  return <Outlet />
}
