import { Outlet, createFileRoute } from '@tanstack/react-router'
import { storeProject } from '~/projects/store'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'

import { getTanstackDocsConfig } from '~/utils/config'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/store/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(storeProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: storeProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Store Docs | TanStack Store',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Store"
      version={version === 'latest' ? storeProject.latestVersion : version!}
      colorFrom={storeProject.colorFrom}
      colorTo={storeProject.colorTo}
      textColor={storeProject.textColor}
      config={config}
      frameworks={storeProject.frameworks}
      versions={storeProject.availableVersions}
      repo={storeProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
