import { Link, Outlet, useLocation, useSearchParams } from '@remix-run/react'
import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { fetchRepoFile } from '~/utils/documents.server'
import { repo, getBranch, latestVersion } from '~/projects/query'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const loader = async (context: LoaderFunctionArgs) => {
  const branch = getBranch(context.params.version)
  const config = await fetchRepoFile(repo, branch, `docs/config.json`)

  if (!config) {
    throw new Error('Repo docs/config.json not found!')
  }

  return json(JSON.parse(config))
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteVersionParam() {
  const location = useLocation()
  const [params] = useSearchParams()

  const showV3Redirect = params.get('from') === 'reactQueryV3'
  const original = params.get('original')

  const version = location.pathname.match(/\/query\/v(\d)/)?.[1] || '999'

  return (
    <>
      {showV3Redirect ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{' '}
            <a
              href={original || '/query/latest'}
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
      <RedirectVersionBanner
        currentVersion={version}
        latestVersion={latestVersion}
      />
      <Outlet />
    </>
  )
}
