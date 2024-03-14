import { Outlet, createFileRoute } from '@tanstack/react-router'
import {
  repo,
  getBranch,
  colorTo,
  latestVersion,
  colorFrom,
  textColor,
  availableVersions,
  frameworks,
} from '~/projects/query'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'

export const Route = createFileRoute('/query/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(ctx.params.version)
    const config = await getTanstackDocsConfig({ repo, branch })

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
      name="Ranger"
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
