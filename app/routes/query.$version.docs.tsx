import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { getBranch, repo } from '~/projects/query'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async (context: LoaderFunctionArgs) => {
  const branch = getBranch(context.params.version)
  const tanstackDocsConfig = await getTanstackDocsConfig(repo, branch)
  const { version, framework } = context.params

  return json({
    tanstackDocsConfig,
    framework,
    version,
  })
}

export type QueryConfigLoader = typeof loader

export default function RouteDocsParam() {
  return <Outlet />
}
