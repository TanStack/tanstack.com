import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { formProject } from '~/projects/form'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const Route = createFileRoute('/form/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    if (!formProject.availableVersions.concat('latest').includes(version!)) {
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
        latestVersion={formProject.latestVersion}
      />
      <Outlet />
    </>
  )
}
