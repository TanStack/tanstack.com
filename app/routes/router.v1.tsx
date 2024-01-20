import { Link, Outlet, useLocation, useSearchParams } from '@remix-run/react'
import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { v1branch } from '~/projects/router'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader: LoaderFunction = async () => {
  const repo = 'tanstack/router'

  const tanstackDocsConfig = await getTanstackDocsConfig(repo, v1branch)

  return json({
    tanstackDocsConfig,
  })
}

export type RouterConfigLoaderData = typeof loader

export const ErrorBoundary = DefaultErrorBoundary

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
