import * as React from 'react'
import { Link, Outlet, useLocation, useSearchParams } from '@remix-run/react'
import { json } from '@remix-run/node'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { fetchRepoFile } from '~/utils/documents.server'
import { useMatchesData } from '~/utils/utils'

export const repo = 'tanstack/query'
export const v4branch = 'main'

export type GithubDocsConfig = {
  docSearch: {
    appId: string;
    indexName: string;
    apiKey: string;
  };
  menu: {
    framework: string | React.ReactNode;
    menuItems: {
      label: string | React.ReactNode;
      children: {
        label: string;
        to: string;
      }[];
    }[];
  }[];
};

export const loader = async () => {
  const config = await fetchRepoFile(
    repo,
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
export const CatchBoundary = DefaultCatchBoundary

export const useReactQueryV4Config = () =>
  useMatchesData('/query/v4') as GithubDocsConfig

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
