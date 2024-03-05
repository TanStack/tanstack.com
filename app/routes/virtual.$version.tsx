import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { useClientOnlyRender } from '~/utils/useClientOnlyRender'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import {
  availableVersions,
  latestVersion,
  reactVirtualV2List,
} from '~/projects/virtual'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const Route = createFileRoute('/virtual/$version')({
  loader: (ctx) => {
    const { version } = ctx.params

    handleRedirects(
      reactVirtualV2List,
      ctx.location.href,
      '/virtual/v2',
      '/virtual/v3',
      'from=reactVirtualV2'
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
  component: RouteReactVirtual,
})

export default function RouteReactVirtual() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner version={version!} latestVersion={latestVersion} />
      <Outlet />
    </>
  )
}
