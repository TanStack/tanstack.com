import * as React from 'react'
import { Outlet, json, redirect, useLoaderData } from '@remix-run/react'
import {
  availableVersions,
  useRangerDocsConfig,
  repo,
  getBranch,
  colorTo,
  latestVersion,
  colorFrom,
  textColor,
} from '~/projects/ranger'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'
import type { MetaFunction, LoaderFunctionArgs } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  const { version } = context.params
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
    title: 'TanStack Ranger Docs | React Ranger',
    description: 'Modern and headless ranger UI library',
  })
}

export default function DocsRoute() {
  const { version, tanstackDocsConfig } = useLoaderData<typeof loader>()
  let config = useRangerDocsConfig(tanstackDocsConfig)
  return (
    <DocsLayout
      name="Ranger"
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
