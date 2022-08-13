import * as React from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { Link } from '@remix-run/react'
import { MetaFunction } from '@remix-run/node'
import { useRouterV4Config } from '../v4'
import { gradientText } from './index'
import { seo } from '~/utils/seo'
import { Docs, DocsConfig } from '~/components/Docs'

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className={`font-bold`}>
      <span className={`${gradientText}`}>Router</span>{' '}
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
          Github <FaGithub className="text-lg opacity-20" />
        </div>
      ),
      to: 'https://github.com/tanstack/router',
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

export let meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Router Docs | React Router, Solid Router, Svelte Router, Vue Router',
    description:
      'Headless UI for virtualizing long scrollable lists with TS/JS, React, Solid, Svelte and Vue',
  })
}

export default function DocsRoute() {
  let config = useRouterV4Config()

  config = React.useMemo(
    () =>
      ({
        ...config,
        menu: [localMenu, ...config.menu],
      } as DocsConfig),
    [config]
  )

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
