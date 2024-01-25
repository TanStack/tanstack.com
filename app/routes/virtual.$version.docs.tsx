import { Outlet, json, useLoaderData } from '@remix-run/react'
import {
  createLogo,
  getBranch,
  repo,
  useVirtualDocsConfig,
} from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  const version = context.params.version
  const branch = getBranch(version)
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
      v2={true}
      logo={createLogo(version)}
      colorFrom={'from-rose-500'}
      colorTo={'to-violet-500'}
      textColor={'text-violet-500'}
      config={config}
      framework={config.frameworkConfig}
      version={config.versionConfig}
    >
      <Outlet />
    </DocsLayout>
  )
}
