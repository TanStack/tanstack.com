import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { availableVersions, latestVersion } from '~/projects/ranger'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { reactQueryV3List, reactQueryV3RemovedInV5List } from '~/projects/query'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const Route = createFileRoute('/query/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    handleRedirects(
      reactQueryV3List,
      ctx.location.href,
      '/query/v3',
      '/query/latest',
      'from=reactQueryV3'
    )

    handleRedirects(
      reactQueryV3RemovedInV5List,
      ctx.location.href,
      '/query/v3',
      '/query/v5',
      'from=reactQueryV3'
    )

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
  component: RouteComp,
})

function RouteComp() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner version={version!} latestVersion={latestVersion} />
      <Outlet />
    </>
  )
}
