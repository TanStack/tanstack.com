import * as React from 'react'
import { Link, Outlet, useLocation, useSearchParams } from '@remix-run/react'
import { json, LoaderFunction, MetaFunction } from '@remix-run/node'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DocsConfig } from '~/components/Docs'
import { fetchRepoFile } from '~/utils/documents.server'
import { useMatchesData } from '~/utils/utils'

export const v4branch = 'beta'

export const loader: LoaderFunction = async () => {
  const config = await fetchRepoFile(
    'tanstack/query',
    v4branch,
    `docs/config.json`
  )

  const parsedConfig = JSON.parse(config ?? '')

  if (!parsedConfig) {
    throw new Error('Repo docs/config.json not found!')
  }

  return json(parsedConfig)
}

export const ErrorBoundary = DefaultErrorBoundary

export const useReactQueryV4Config = () =>
  useMatchesData('/query/v4') as DocsConfig

export default function RouteReactQuery() {
  const [params] = useSearchParams()
  const location = useLocation()

  const show = params.get('from') === 'reactQueryV3'
  const original = params.get('original')

  return (
    <>
      {show ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{' '}
            <a
              href={original || 'https://react-query-v3.tanstack.com'}
              className="font-bold underline"
            >
              React Query v3 documentation
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
