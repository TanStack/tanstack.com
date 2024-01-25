import * as React from 'react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json, useLoaderData } from '@remix-run/react'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { QueryGGBanner } from '~/components/QueryGGBanner'
import {
  getBranch,
  createLogo,
  repo,
  useQueryDocsConfig,
} from '~/projects/query'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async (context: LoaderFunctionArgs) => {
  const { version } = context.params
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
      'TanStack Query Docs | React Query, Solid Query, Svelte Query, Vue Query',
  })
}

export default function RouteFrameworkParam() {
  const { tanstackDocsConfig, version } = useLoaderData<typeof loader>()
  let config = useQueryDocsConfig(tanstackDocsConfig)

  return (
    <>
      <QueryGGBanner />
      <DocsLayout
        v2={true}
        logo={createLogo(version)}
        colorFrom={'from-rose-500'}
        colorTo={'to-violet-500'}
        textColor={'text-violet-500'}
        config={config}
        framework={config.frameworkConfig}
        version={config.versionConfig}
      />
    </>
  )
}
