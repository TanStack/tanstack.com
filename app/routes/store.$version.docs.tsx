import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { Docs } from '~/components/Docs'
import {
  createLogo,
  getBranch,
  repo,
  useReactStoreDocsConfig,
} from '~/projects/store'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async (context: LoaderFunctionArgs) => {
  const branch = getBranch(context.params.version)
  const tanstackDocsConfig = await getTanstackDocsConfig(repo, branch)
  const { version } = context.params

  return json({
    tanstackDocsConfig,
    version,
  })
}

export default function Component() {
  const { tanstackDocsConfig, version } = useLoaderData<typeof loader>()
  let config = useReactStoreDocsConfig(tanstackDocsConfig)

  return (
    <Docs
      {...{
        v2: true,
        logo: createLogo(version),
        colorFrom: 'from-gray-700',
        colorTo: 'to-gray-900',
        textColor: 'text-gray-700',
        config,
        framework: config.frameworkConfig,
        version: config.versionConfig,
      }}
    >
      <Outlet />
    </Docs>
  )
}
