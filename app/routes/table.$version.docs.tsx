import { Outlet, createFileRoute } from '@tanstack/react-router'
import { tableProject } from '~/projects/table'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'

import { getTanstackDocsConfig } from '~/utils/config'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/table/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(tableProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: tableProject.repo,
      branch,
    })

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
      version={version === 'latest' ? tableProject.latestVersion : version!}
      colorFrom={tableProject.colorFrom}
      colorTo={tableProject.colorTo}
      textColor={tableProject.textColor}
      config={config}
      frameworks={tableProject.frameworks}
      versions={tableProject.availableVersions}
      repo={tableProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
