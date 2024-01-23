import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { DocsLayout } from '~/components/DocsLayout'
import { createLogo, getBranch, repo, useFormDocsConfig } from '~/projects/form'
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
  const { version, tanstackDocsConfig } = useLoaderData<typeof loader>()
  let config = useFormDocsConfig(tanstackDocsConfig)
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
