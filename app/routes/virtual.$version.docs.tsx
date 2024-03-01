import { Outlet, createFileRoute } from '@tanstack/react-router'
import {
  getBranch,
  latestVersion,
  repo,
  colorFrom,
  colorTo,
  textColor,
  availableVersions,
  frameworks,
} from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'

export const Route = createFileRoute('/virtual/$version/docs')({
  loader: async (ctx) => {
    const branch = getBranch(ctx.params.version)
    const config = await getTanstackDocsConfig({ repo, branch })

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

export default function DocsRoute() {
  const { config } = Route.useLoaderData()
  const { version } = Route.useParams()

  return (
    <DocsLayout
      name="Virtual"
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
