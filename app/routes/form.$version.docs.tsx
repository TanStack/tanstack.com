import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { getBranch } from '~/projects'
import { formProject } from '~/projects/form'
import { getTanstackDocsConfig } from '~/utils/config'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/form/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(formProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: formProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Form Docs | TanStack Form',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Form"
      version={version === 'latest' ? formProject.latestVersion : version!}
      colorFrom={formProject.colorFrom}
      colorTo={formProject.colorTo}
      textColor={formProject.textColor}
      config={config}
      frameworks={formProject.frameworks}
      versions={formProject.availableVersions}
      repo={formProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
