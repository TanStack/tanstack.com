import { Outlet, json, redirect, useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import {
  repo,
  getBranch,
  useRouterDocsConfig,
  availableVersions,
  latestVersion,
  colorFrom,
  colorTo,
  textColor,
} from '~/projects/router'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'

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
    title: 'TanStack Router Docs | React Router',
    description: 'Modern and scalable routing for React applications',
  })
}

export default function DocsRoute() {
  const { tanstackDocsConfig, version } = useLoaderData<typeof loader>()
  let config = useRouterDocsConfig(tanstackDocsConfig)

  return (
    <DocsLayout
      name="Router"
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
