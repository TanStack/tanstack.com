import * as React from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { Link } from '@remix-run/react'
import { MetaFunction } from '@remix-run/node'

import { useReactTableV8Config } from '../v8'
import { gradientText } from './index'
import { seo } from '~/utils/seo'
import { Docs, DocsConfig } from '~/components/Docs'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className={`font-bold`}>
      <span className={`${gradientText}`}>Table</span>{' '}
      <span className="text-sm align-super">v8</span>
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
      to: 'https://github.com/tanstack/table',
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
      'TanStack Table Docs | React Table, Solid Table, Svelte Table, Vue Table',
    description:
      'Headless UI for building powerful tables & datagrids with TS/JS, React, Solid, Svelte and Vue',
  })
}

export const ErrorBoundary = DefaultErrorBoundary
export const CatchBoundary = DefaultCatchBoundary

export default function RouteReactTable() {
  let config = useReactTableV8Config()

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
        colorFrom: 'from-teal-500',
        colorTo: 'to-blue-500',
        textColor: 'text-blue-500',
        config,
      }}
    />
  )
}
