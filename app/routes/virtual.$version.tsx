import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { virtualProject } from '~/projects/virtual'
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

    if (!virtualProject.availableVersions.concat('latest').includes(version!)) {
      throw redirect({
        params: {
          version: 'latest',
        },
      })
    }
  },
  component: RouteReactVirtual,
})

export default function RouteReactVirtual() {
  const { version } = Route.useParams()

  return (
    <>
      <RedirectVersionBanner
        version={version!}
        latestVersion={virtualProject.latestVersion}
      />
      <Outlet />
    </>
  )
}

// prettier-ignore
export const reactVirtualV2List = [
    {from: 'docs/overview',to: 'docs/introduction',},
    {from: 'docs/installation',to: 'docs/installation',},
    {from: 'docs/api',to: 'docs/api/virtualizer',},
    {from: 'examples/fixed',to: 'docs/framework/react/examples/fixed',},
    {from: 'examples/variable',to: 'docs/framework/react/examples/variable',},
    {from: 'examples/dynamic',to: 'docs/framework/react/examples/dynamic',},
    {from: 'examples/infinite-scroll',to: 'docs/framework/react/examples/infinite-scroll',},
    {from: 'examples/padding',to: 'docs/framework/react/examples/padding',},
    {from: 'examples/smooth-scroll',to: 'docs/framework/react/examples/smooth-scroll',},
    {from: 'examples/sticky',to: 'docs/framework/react/examples/sticky',},
    {from: '',to: '',},
  ]
