import { Outlet, useParams } from '@remix-run/react'
import { Docs } from '~/components/Docs'
import { createLogo, useReactFormDocsConfig } from '~/routes/form'

export default function Component() {
  const { version } = useParams()
  let config = useReactFormDocsConfig()
  return (
    <Docs
      {...{
        v2: true,
        logo: createLogo(version),
        colorFrom: 'from-rose-500',
        colorTo: 'to-violet-500',
        textColor: 'text-violet-500',
        config,
        framework: config.frameworkConfig,
        version: config.versionConfig,
      }}
    >
      <Outlet />
    </Docs>
  )
}
