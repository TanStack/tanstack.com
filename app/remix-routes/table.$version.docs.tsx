import { Outlet, json, useLoaderData } from '@tanstack/react-router'
import {
  getBranch,
  repo,
  latestVersion,
  colorFrom,
  colorTo,
  textColor,
  availableVersions,
  frameworks,
} from '~/projects/table'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'

import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async (context) => {
  const version = context.params.version
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
      'TanStack Table Docs | React Table, Solid Table, Svelte Table, Vue Table',
    description:
      'Headless UI for building powerful tables & datagrids with TS/JS, React, Solid, Svelte and Vue',
  })
}

export default function RouteReactTable() {
  const { version, config } = useLoaderData<typeof loader>()

  return (
    <DocsLayout
      name="Table"
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
