import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { storeProject } from '~/projects/store'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'

export const Route = createFileRoute('/store/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    if (!storeProject.availableVersions.concat('latest').includes(version!)) {
      throw redirect({
        params: {
          version: 'latest',
        },
      })
    }
  },
  component: RouteReactTable,
})

export default function RouteReactTable() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner
        version={version!}
        latestVersion={storeProject.latestVersion}
      />
      <Outlet />
    </>
  )
}
