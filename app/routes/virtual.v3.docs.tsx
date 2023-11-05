import { useMemo } from 'react'
import { FaBrandsDiscord, FaBrandsGithub } from '~/components/icons'
import { Link } from '@remix-run/react'
import { useVirtualV3Config } from '~/routes/virtual.v3'
import { gradientText } from '~/routes/virtual.v3._index'
import { seo } from '~/utils/seo'
import { Docs } from '~/components/Docs'
import type { MetaFunction } from '@remix-run/react'
import type { DocsConfig } from '~/components/Docs'

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
          GitHub <FaBrandsGithub className="text-lg opacity-20" />
        </div>
      ),
      to: 'https://github.com/tanstack/virtual',
    },
    {
      label: (
        <div className="flex items-center gap-2">
          Discord <FaBrandsDiscord className="text-lg opacity-20" />
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

export default function RouteReactTable() {
  let config = useVirtualV3Config()

  config = useMemo(
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
