import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { getBranch } from '~/projects'
import { configProject } from '~/projects/config'
import { getTanstackDocsConfig } from '~/utils/config'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/config/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(configProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: configProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Config Docs | TanStack Config',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Config"
      version={
        configProject.version === 'latest'
          ? configProject.latestVersion
          : version!
      }
      colorFrom={configProject.colorFrom}
      colorTo={configProject.colorTo}
      textColor={configProject.textColor}
      config={config}
      frameworks={configProject.frameworks}
      versions={configProject.availableVersions}
      repo={configProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
