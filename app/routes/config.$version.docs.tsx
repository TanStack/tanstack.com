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
} from '~/projects/config'
import { getTanstackDocsConfig } from '~/utils/config'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/config/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(ctx.params.version)
    const config = await getTanstackDocsConfig({ repo, branch })

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
