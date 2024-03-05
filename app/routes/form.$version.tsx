import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { availableVersions, latestVersion } from '~/projects/form'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const Route = createFileRoute('/form/$version')({
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
  component: RouteForm,
})

function RouteForm() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner version={version!} latestVersion={latestVersion} />
      <Outlet />
    </>
  )
}
