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
  useStoreDocsConfig,
} from '~/projects/store'
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

export default function Component() {
  const { tanstackDocsConfig, version } = useLoaderData<typeof loader>()
  let config = useStoreDocsConfig(tanstackDocsConfig)

  return (
    <DocsLayout
      name="Store"
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
