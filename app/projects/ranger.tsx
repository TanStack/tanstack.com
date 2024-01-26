import reactLogo from '~/images/react-logo.svg'
import { FaDiscord, FaGithub } from 'react-icons/fa/index'
import { useDocsConfig } from '~/utils/config'
import type { ConfigSchema, MenuItem } from '~/utils/config'

export const repo = 'tanstack/ranger'

export const latestBranch = 'main'
export const latestVersion = 'v0'
export const availableVersions = ['v0']

export const colorFrom = 'from-lime-500'
export const colorTo = 'to-emerald-500'
export const textColor = 'text-emerald-500'

const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
} as const

export type Framework = keyof typeof frameworks

const localMenu: MenuItem = {
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

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}

export const useRangerDocsConfig = (config: ConfigSchema) => {
  return useDocsConfig({
    config,
    frameworks,
    localMenu,
    availableVersions,
  })
}
