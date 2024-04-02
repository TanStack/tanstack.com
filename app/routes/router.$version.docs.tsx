import { Outlet, createFileRoute } from '@tanstack/react-router'
import { routerProject } from '~/projects/router'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/router/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(routerProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: routerProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Router Docs | TanStack Router',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Router"
      version={version === 'latest' ? routerProject.latestVersion : version!}
      colorFrom={routerProject.colorFrom}
      colorTo={routerProject.colorTo}
      textColor={routerProject.textColor}
      config={config}
      frameworks={routerProject.frameworks}
      versions={routerProject.availableVersions}
      repo={routerProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
