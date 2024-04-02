import { Outlet, createFileRoute } from '@tanstack/react-router'
import { queryProject } from '~/projects/query'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/query/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(queryProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: queryProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title:
        'TanStack Query Docs | React Query, Solid Query, Svelte Query, Vue Query',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Query"
      version={version === 'latest' ? queryProject.latestVersion : version!}
      colorFrom={queryProject.colorFrom}
      colorTo={queryProject.colorTo}
      textColor={queryProject.textColor}
      config={config}
      frameworks={queryProject.frameworks}
      versions={queryProject.availableVersions}
      repo={queryProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
