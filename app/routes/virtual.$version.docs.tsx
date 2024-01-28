import { Outlet, json, useLoaderData } from '@remix-run/react'
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
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  const version = context.params.version
  const branch = getBranch(version)

  const config = await getTanstackDocsConfig(repo, branch)

  return json({
    config,
    version,
  })
}

export const meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Virtual Docs | React Virtual, Solid Virtual, Svelte Virtual, Vue Virtual',
    description:
      'Headless UI for virtualizing long scrollable lists with TS/JS, React, Solid, Svelte and Vue',
  })
}

export default function RouteVirtual() {
  const { version, config } = useLoaderData<typeof loader>()

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
