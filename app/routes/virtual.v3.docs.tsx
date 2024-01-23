import { FaDiscord, FaGithub } from 'react-icons/fa'
import { Link, json, useLoaderData } from '@remix-run/react'
import { gradientText, repo, v3branch } from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { DocsLayout } from '~/components/DocsLayout'
import type { MetaFunction } from '@remix-run/react'
import { getTanstackDocsConfig } from '~/utils/config'
import { useMemo } from 'react'

export const loader = async () => {
  const tanstackDocsConfig = await getTanstackDocsConfig(repo, v3branch)

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
      <span className={`${gradientText}`}>Virtual</span>{' '}
      <span className="text-sm align-super">v3</span>
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
      to: 'https://github.com/tanstack/virtual',
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
    title:
      'TanStack Virtual Docs | React Virtual, Solid Virtual, Svelte Virtual, Vue Virtual',
    description:
      'Headless UI for virtualizing long scrollable lists with TS/JS, React, Solid, Svelte and Vue',
  })
}

export default function RouteVirtual() {
  const { tanstackDocsConfig } = useLoaderData<typeof loader>()

  const config = useMemo(
    () => ({
      ...tanstackDocsConfig,
      menu: [localMenu, ...tanstackDocsConfig.menu],
    }),
    [tanstackDocsConfig]
  )

  return (
    <DocsLayout
      logo={logo}
      colorFrom={'from-rose-500'}
      colorTo={'to-violet-500'}
      textColor={'text-violet-500'}
      config={config}
    />
  )
}
