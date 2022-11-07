import { Link, Outlet, useLocation, useSearchParams } from '@remix-run/react'
import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import type { DocsConfig } from '~/components/Docs'
import { fetchRepoFile } from '~/utils/documents.server'
import { useMatchesData } from '~/utils/utils'

export const v1branch = 'beta'

export const loader: LoaderFunction = async () => {
  const config = await fetchRepoFile(
    'tanstack/router',
    v1branch,
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

export const useRouterV1Config = () =>
  useMatchesData('/router/v1') as DocsConfig

export default function RouteReactRouter() {
  const [params] = useSearchParams()
  const location = useLocation()

  const show = params.get('from') === 'reactLocationV2'
  const original = params.get('original')

  return (
    <>
      {show ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{' '}
            <a
              href={original || 'https://react-router-v2.tanstack.com'}
              className="font-bold underline"
            >
              React Location v2 documentation
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
