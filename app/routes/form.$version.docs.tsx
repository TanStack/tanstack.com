import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import {
  availableVersions,
  colorFrom,
  colorTo,
  frameworks,
  getBranch,
  latestVersion,
  repo,
  textColor,
} from '~/projects/form'
import { getTanstackDocsConfig } from '~/utils/config'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/form/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(ctx.params.version)
    const config = await getTanstackDocsConfig({ repo, branch })

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
      version={version === 'latest' ? latestVersion : version!}
      colorFrom={colorFrom}
      colorTo={colorTo}
      textColor={textColor}
      config={config}
      frameworks={frameworks}
      availableVersions={availableVersions}
      repo={repo}
    >
      <Outlet />
    </DocsLayout>
  )
}
