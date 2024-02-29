import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { availableVersions, latestVersion } from '~/projects/router'
import { useClientOnlyRender } from '~/utils/useClientOnlyRender'

export const Route = createFileRoute('/router/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    if (!availableVersions.concat('latest').includes(version!)) {
      throw redirect({
        params: {
          version: 'latest',
        },
      })
    }

    return {
      version,
    }
  },
  component: RouteReactRouter,
})

function RouteReactRouter() {
  const { version } = Route.useLoaderData()

  return (
    <>
      <RedirectVersionBanner version={version!} latestVersion={latestVersion} />
      <Outlet />
    </>
  )
}
