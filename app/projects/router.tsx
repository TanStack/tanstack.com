import { Link } from '@remix-run/react'
import reactLogo from '~/images/react-logo.svg'
import { FaDiscord, FaGithub } from 'react-icons/fa/index'
import { useDocsConfig } from '~/utils/config'
import type { ConfigSchema, MenuItem } from '~/utils/config'

export const repo = 'tanstack/router'

export const latestBranch = 'main'
export const latestVersion = 'v1'
export const availableVersions = ['v1']

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500'

const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
} as const

export type Framework = keyof typeof frameworks

export const createLogo = (version?: string) => (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className="font-bold">
      <span className={`${gradientText}`}>Router</span>
      <span className="text-sm align-super">
        {version === 'latest' ? latestVersion : version}
      </span>
    </Link>
  </>
)

export const localMenu: MenuItem = {
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

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}

export const useRouterDocsConfig = (config: ConfigSchema) => {
  return useDocsConfig({
    config,
    frameworks,
    localMenu,
    availableVersions,
  })
}
