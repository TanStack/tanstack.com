import { Outlet, json, redirect, useLoaderData } from '@remix-run/react'
import {
  availableVersions,
  getBranch,
  latestVersion,
  repo,
  useVirtualDocsConfig,
  colorFrom,
  colorTo,
  textColor,
} from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  const version = context.params.version
  const branch = getBranch(version)

  if (!availableVersions.concat('latest').includes(version!)) {
    throw redirect(context.request.url.replace(version!, 'latest'))
  }

  const tanstackDocsConfig = await getTanstackDocsConfig(repo, branch)

  return json({
    tanstackDocsConfig,
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
  const { version, tanstackDocsConfig } = useLoaderData<typeof loader>()
  let config = useVirtualDocsConfig(tanstackDocsConfig)

  return (
    <DocsLayout
      name="Virtual"
      version={version === 'latest' ? latestVersion : version!}
      colorFrom={colorFrom}
      colorTo={colorTo}
      textColor={textColor}
      config={config}
    >
      <Outlet />
    </DocsLayout>
  )
}
