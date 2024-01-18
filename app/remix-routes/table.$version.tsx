import { Outlet, json, redirect, useLoaderData } from '@remix-run/react'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'
import { availableVersions, latestVersion } from '~/projects/table'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import type { LoaderFunctionArgs } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  const { version } = context.params

  if (version === 'v7') {
    throw redirect('/table/v8?from=reactTableV7')
  }

  const redirectUrl = context.request.url.replace(version!, 'latest')

  if (!availableVersions.concat('latest').includes(version!)) {
    throw redirect(redirectUrl)
  }

  return json({
    version,
    redirectUrl,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTable() {
  const { version, redirectUrl } = useLoaderData<typeof loader>()

  if (!useClientOnlyRender()) {
    return null
  }

  return (
    <>
      <RedirectVersionBanner
        version={version!}
        latestVersion={latestVersion}
        redirectUrl={redirectUrl}
      />
      <Outlet />
    </>
  )
}
