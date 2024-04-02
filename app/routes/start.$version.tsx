import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { startProject } from '~/projects/start'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const Route = createFileRoute('/start/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    if (!startProject.availableVersions.concat('latest').includes(version!)) {
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
      <RedirectVersionBanner
        version={version!}
        latestVersion={startProject.latestVersion}
      />
      <Outlet />
    </>
  )
}
