import { Outlet, json, useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import {
  repo,
  getBranch,
  latestVersion,
  colorFrom,
  colorTo,
  textColor,
  availableVersions,
  frameworks,
} from '~/projects/router'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async (context: LoaderFunctionArgs) => {
  const { version } = context.params
  const branch = getBranch(version)

  const config = await getTanstackDocsConfig(repo, branch)

  return json({
    config,
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
  const { config, version } = useLoaderData<typeof loader>()

  return (
    <DocsLayout
      name="Router"
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
