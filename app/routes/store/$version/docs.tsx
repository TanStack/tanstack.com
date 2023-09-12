import { Outlet, useParams } from '@remix-run/react'
import { Docs } from '~/components/Docs'
import { createLogo, useReactStoreDocsConfig } from '~/routes/store'

export default function Component() {
  const { version } = useParams()
  let config = useReactStoreDocsConfig()
  return (
    <Docs
      {...{
        v2: true,
        logo: createLogo(version),
        colorFrom: 'from-red-500',
        colorTo: 'to-red-700',
        textColor: 'text-red-500',
        config,
        framework: config.frameworkConfig,
        version: config.versionConfig,
      }}
    >
      <Outlet />
    </Docs>
  )
}
