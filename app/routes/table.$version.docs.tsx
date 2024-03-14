import { Outlet, createFileRoute } from '@tanstack/react-router'
import {
  getBranch,
  repo,
  latestVersion,
  colorFrom,
  colorTo,
  textColor,
  availableVersions,
  frameworks,
} from '~/projects/table'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'

import { getTanstackDocsConfig } from '~/utils/config'

export const Route = createFileRoute('/table/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(ctx.params.version)
    const config = await getTanstackDocsConfig({ repo, branch })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Table Docs | TanStack Table',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Table"
      version={version === 'latest' ? latestVersion : version!}
      colorFrom={colorFrom}
      colorTo={colorTo}
      textColor={textColor}
      config={config}
      frameworks={frameworks}
      versions={availableVersions}
      repo={repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
