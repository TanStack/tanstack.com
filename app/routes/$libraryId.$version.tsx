import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { getLibrary } from '~/libraries'

export const Route = createFileRoute('/$libraryId/$version')({
  loader: (ctx) => {
    const { libraryId, version } = ctx.params
    const library = getLibrary(libraryId)

    library.handleRedirects?.(ctx.location.href)

    if (!library.availableVersions.concat('latest').includes(version!)) {
      throw redirect({
        params: {
          version: 'latest',
        },
      })
    }
  },
  component: RouteForm,
})

function RouteForm() {
  const { libraryId, version } = Route.useParams()
  const library = getLibrary(libraryId)

  return (
    <>
      <RedirectVersionBanner
        version={version!}
        latestVersion={library.latestVersion}
      />
      <Outlet />
    </>
  )
}
