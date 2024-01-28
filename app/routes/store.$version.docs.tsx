import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { DocsLayout } from '~/components/DocsLayout'
import {
  getBranch,
  latestVersion,
  repo,
  textColor,
  colorFrom,
  colorTo,
  availableVersions,
  frameworks,
} from '~/projects/store'
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

export default function Component() {
  const { config, version } = useLoaderData<typeof loader>()

  return (
    <DocsLayout
      name="Store"
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
