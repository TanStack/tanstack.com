import * as React from 'react'
import {
  json,
  Link,
  LoaderFunction,
  MetaFunction,
  Outlet,
  useLocation,
  useSearchParams,
} from 'remix'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DocsConfig } from '~/components/Docs'
import { fetchRepoFile } from '~/utils/documents.server'
import { seo } from '~/utils/seo'
import { useMatchesData } from '~/utils/utils'

export const v8branch = 'main'

export const loader: LoaderFunction = async () => {
  const config = await fetchRepoFile(
    'tanstack/table',
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
  useMatchesData('/table/v8') as DocsConfig

export default function RouteReactTable() {
  const [params] = useSearchParams()
  const location = useLocation()

  const show = params.get('from') === 'reactTableV7'
  const original = params.get('original')

  return (
    <>
      {show ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{' '}
            <a
              href={original || 'https://react-table-v7.tanstack.com'}
              className="font-bold underline"
            >
              React Table v7 documentation
            </a>
            ?
          </div>
          <Link
            to={location.pathname}
            replace
            className="bg-white text-black py-1 px-2 rounded-md uppercase font-black text-xs"
          >
            Hide
          </Link>
        </div>
      ) : null}
      <Outlet />
    </>
  )
}
