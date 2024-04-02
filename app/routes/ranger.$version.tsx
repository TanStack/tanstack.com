import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { rangerProject } from '~/projects/ranger'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const Route = createFileRoute('/ranger/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    if (!rangerProject.availableVersions.concat('latest').includes(version!)) {
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
  component: RouteForm,
})

function RouteForm() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner
        version={version!}
        latestVersion={rangerProject.latestVersion}
      />
      <Outlet />
    </>
  )
}
