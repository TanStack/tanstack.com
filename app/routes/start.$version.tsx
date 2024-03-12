import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { availableVersions, latestVersion } from '~/projects/start'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const Route = createFileRoute('/start/$version')({
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
  component: RouteVersion,
})

function RouteVersion() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner version={version!} latestVersion={latestVersion} />
      <Outlet />
    </>
  )
}
