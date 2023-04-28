import type { MetaFunction } from '@remix-run/node'
import { seo } from '~/utils/seo'
import { Docs } from '~/components/Docs'
import { createLogo, useReactFormDocsConfig } from '~/routes/form'
import { Outlet } from '@remix-run/react'

export let meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Query Docs | React Query, Solid Query, Svelte Query, Vue Query',
  })
}

export default function RouteFrameworkParam() {
  let config = useReactFormDocsConfig()

  return (
    <>
      <Outlet />
      {/* <Docs
        {...{
          logo: createLogo(config.versionConfig.selected),
          colorFrom: 'from-rose-500',
          colorTo: 'to-violet-500',
          textColor: 'text-violet-500',
          config: config!,
          framework: config.frameworkConfig,
          version: config.versionConfig,
        }}
      /> */}
    </>
  )
}
