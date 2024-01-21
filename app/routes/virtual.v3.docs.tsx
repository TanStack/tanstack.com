import { FaDiscord, FaGithub } from 'react-icons/fa'
import { Link, json, useLoaderData } from '@remix-run/react'
import { gradientText, repo, v3branch } from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { Docs } from '~/components/Docs'
import type { ClientLoaderFunctionArgs, MetaFunction } from '@remix-run/react'
import { getTanstackDocsConfig } from '~/utils/config'

export const loader = async () => {
  const tanstackDocsConfig = await getTanstackDocsConfig(repo, v3branch)

  return json({
    tanstackDocsConfig,
  })
}

export type VirtualConfigLoaderData = typeof loader

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
export const clientLoader = async ({
  serverLoader,
}: ClientLoaderFunctionArgs) => {
  const { tanstackDocsConfig } = await serverLoader<typeof loader>()

  const config = {
    ...tanstackDocsConfig,
    menu: [localMenu, ...tanstackDocsConfig.menu],
  }

  return config
}

export default function RouteVirtual() {
  const config = useLoaderData<typeof clientLoader>()

  return (
    <Docs
      {...{
        logo,
        colorFrom: 'from-rose-500',
        colorTo: 'to-violet-500',
        textColor: 'text-violet-500',
        config,
      }}
    />
  )
}
