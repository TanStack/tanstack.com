import { Outlet, createFileRoute } from '@tanstack/react-router'
import { virtualProject } from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/virtual/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(virtualProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: virtualProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Virtual Docs | TanStack Virtual',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Virtual"
      version={version === 'latest' ? virtualProject.latestVersion : version!}
      colorFrom={virtualProject.colorFrom}
      colorTo={virtualProject.colorTo}
      textColor={virtualProject.textColor}
      config={config}
      frameworks={virtualProject.frameworks}
      versions={virtualProject.availableVersions}
      repo={virtualProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
