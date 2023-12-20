import { Link, Outlet, useLocation, useSearchParams } from '@remix-run/react'
import { json } from '@remix-run/node'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import type { DocsConfig } from '~/components/Docs'
import { fetchRepoFile } from '~/utils/documents.server'
import { useMatchesData } from '~/utils/utils'

export const v3branch = 'main'

export const loader = async () => {
  const config = await fetchRepoFile(
    'tanstack/virtual',
    v3branch,
    `docs/config.json`
  )

  const parsedConfig = JSON.parse(config ?? '')

  if (!parsedConfig) {
    throw new Error('Repo docs/config.json not found!')
  }

  return json(parsedConfig)
}

export const ErrorBoundary = DefaultErrorBoundary

export const useVirtualV3Config = () =>
  useMatchesData('/virtual/v3') as DocsConfig

export default function RouteReactVirtual() {
  const [params] = useSearchParams()
  const location = useLocation()

  const show = params.get('from') === 'reactVirtualV2'
  const original = params.get('original')

  return (
    <>
      {show ? (
        <div className="p-4 bg-blue-500 text-white flex items-center justify-center gap-4">
          <div>
            Looking for the{' '}
            <a
              href={
                original ||
                'https://github.com/TanStack/virtual/tree/v2/docs/src/pages/docs'
              }
              className="font-bold underline"
            >
              React Virtual v2 documentation
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
