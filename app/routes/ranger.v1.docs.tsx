import * as React from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { Link } from '@remix-run/react'
import type { MetaFunction } from '@remix-run/node'
import { useRangerV1Config } from '~/routes/ranger.v1'
import { gradientText } from '~/routes/ranger.v1._index'
import { seo } from '~/utils/seo'
import type { DocsConfig } from '~/components/Docs'
import { Docs } from '~/components/Docs'

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
  let config = useRangerV1Config()

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
        colorFrom: 'from-lime-500',
        colorTo: 'to-emerald-500',
        textColor: 'text-emerald-500',
        config,
      }}
    />
  )
}
