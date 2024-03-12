import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import {
  availableVersions,
  latestVersion,
  reactTableV7List,
} from '~/projects/table'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const Route = createFileRoute('/table/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    handleRedirects(
      reactTableV7List,
      ctx.location.href,
      '/table/v7',
      '/table/v8',
      'from=reactTableV7'
    )

    if (!availableVersions.concat('latest').includes(version!)) {
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
      <RedirectVersionBanner version={version!} latestVersion={latestVersion} />
      <Outlet />
    </>
  )
}
