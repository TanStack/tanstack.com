import * as React from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { Link, json, useLoaderData } from '@remix-run/react'
import type { MetaFunction } from '@remix-run/node'
import { gradientText, repo, v1branch } from '~/projects/ranger'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async () => {
  const tanstackDocsConfig = await getTanstackDocsConfig(repo, v1branch)

  return json({
    tanstackDocsConfig,
  })
}

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className={`font-bold`}>
      <span className={`${gradientText}`}>Ranger</span>{' '}
      <span className="text-sm align-super">BETA</span>
    </Link>
  </>
)

const localMenu = {
  label: 'Menu',
  children: [
    {
      label: 'Home',
      to: '..',
    },
    {
      label: (
        <div className="flex items-center gap-2">
          GitHub <FaGithub className="text-lg opacity-20" />
        </div>
      ),
      to: 'https://github.com/tanstack/ranger',
    },
    {
      label: (
        <div className="flex items-center gap-2">
          Discord <FaDiscord className="text-lg opacity-20" />
        </div>
      ),
      to: 'https://tlinz.com/discord',
    },
  ],
}

export const meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Ranger Docs | React Ranger',
    description: 'Modern and scalable routing for React applications',
  })
}

export default function DocsRoute() {
  const { tanstackDocsConfig } = useLoaderData<typeof loader>()

  const config = React.useMemo(
    () => ({
      ...tanstackDocsConfig,
      menu: [localMenu, ...tanstackDocsConfig.menu],
    }),
    [tanstackDocsConfig]
  )

  return (
    <DocsLayout
      logo={logo}
      colorFrom={'from-lime-500'}
      colorTo={'to-emerald-500'}
      textColor={'text-emerald-500'}
      config={config}
    />
  )
}
