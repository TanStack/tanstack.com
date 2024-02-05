import { Outlet, json, redirect, useLoaderData } from '@remix-run/react'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import type { LoaderFunctionArgs } from '@remix-run/node'
import {
  availableVersions,
  latestVersion,
  reactVirtualV2List,
} from '~/projects/virtual'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const loader = async (context: LoaderFunctionArgs) => {
  const { version } = context.params

  const redirectUrl = context.request.url.replace(version!, 'latest')

  handleRedirects(
    reactVirtualV2List,
    context.request.url,
    '/virtual/v2',
    '/virtual/v3',
    'from=reactVirtualV2'
  )

  if (!availableVersions.concat('latest').includes(version!)) {
    throw redirect(redirectUrl)
  }

  return json({
    version,
    redirectUrl,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactVirtual() {
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
