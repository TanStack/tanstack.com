import { Outlet, json, redirect, useLoaderData } from '@remix-run/react'
import {
  getBranch,
  createLogo,
  repo,
  useTableDocsConfig,
  availableVersions,
} from '~/projects/table'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { getTanstackDocsConfig } from '~/utils/config'

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
      'TanStack Table Docs | React Table, Solid Table, Svelte Table, Vue Table',
    description:
      'Headless UI for building powerful tables & datagrids with TS/JS, React, Solid, Svelte and Vue',
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTable() {
  const { version, tanstackDocsConfig } = useLoaderData<typeof loader>()
  let config = useTableDocsConfig(tanstackDocsConfig)

  return (
    <DocsLayout
      v2={true}
      logo={createLogo(version)}
      colorFrom={'from-teal-500'}
      colorTo={'to-blue-500'}
      textColor={'text-blue-500'}
      config={config}
      framework={config.frameworkConfig}
      version={config.versionConfig}
    >
      <Outlet />
    </DocsLayout>
  )
}
