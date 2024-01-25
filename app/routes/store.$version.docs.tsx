import { type LoaderFunctionArgs, json, redirect } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { DocsLayout } from '~/components/DocsLayout'
import {
  availableVersions,
  createLogo,
  getBranch,
  repo,
  useStoreDocsConfig,
} from '~/projects/store'
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

export default function Component() {
  const { tanstackDocsConfig, version } = useLoaderData<typeof loader>()
  let config = useStoreDocsConfig(tanstackDocsConfig)

  return (
    <DocsLayout
      v2={true}
      logo={createLogo(version)}
      colorFrom={'from-gray-700'}
      colorTo={'to-gray-900'}
      textColor={'text-gray-700'}
      config={config}
      framework={config.frameworkConfig}
      version={config.versionConfig}
    >
      <Outlet />
    </DocsLayout>
  )
}
