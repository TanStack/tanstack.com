import { Outlet, useParams } from '@remix-run/react'
import { Docs } from '~/components/Docs'
import { createLogo, useReactStoreDocsConfig } from '~/projects/store'

export default function Component() {
  const { version } = useParams()
  let config = useReactStoreDocsConfig()
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
