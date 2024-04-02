import { Outlet, createFileRoute } from '@tanstack/react-router'
import { rangerProject } from '~/projects/ranger'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/ranger/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(rangerProject, ctx.params.version)
    const config = await getTanstackDocsConfig({
      repo: rangerProject.repo,
      branch,
    })

    return {
      config,
    }
  },
  meta: () =>
    seo({
      title: 'TanStack Ranger Docs | TanStack Ranger',
    }),
  component: DocsRoute,
})

function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Ranger"
      version={version === 'latest' ? rangerProject.latestVersion : version!}
      colorFrom={rangerProject.colorFrom}
      colorTo={rangerProject.colorTo}
      textColor={rangerProject.textColor}
      config={config}
      frameworks={rangerProject.frameworks}
      versions={rangerProject.availableVersions}
      repo={rangerProject.repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
