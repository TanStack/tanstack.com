import { Outlet, json, useLoaderData } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { QueryGGBanner } from '~/components/QueryGGBanner'
import {
  getBranch,
  colorFrom,
  colorTo,
  textColor,
  repo,
  latestVersion,
  availableVersions,
  frameworks,
} from '~/projects/query'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async (context) => {
  const { version } = context.params
  const branch = getBranch(version)

  const config = await getTanstackDocsConfig(repo, branch)

  return json({
    config,
    version,
  })
}

export const meta = () => {
  return seo({
    title:
      'TanStack Query Docs | React Query, Solid Query, Svelte Query, Vue Query',
  })
}

export default function RouteFrameworkParam() {
  const { config, version } = Route.useLoaderData()

  return (
    <>
      <QueryGGBanner />
      <DocsLayout
        name="Query"
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
    </>
  )
}
