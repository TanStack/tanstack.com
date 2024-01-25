import { FaDiscord, FaGithub } from 'react-icons/fa'
import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import angularLogo from '~/images/angular-logo.svg'
import { useDocsConfig } from '~/utils/config'
import { Link } from '@remix-run/react'
import type { ConfigSchema, MenuItem } from '~/utils/config'

export const repo = 'tanstack/query'

export const latestBranch = 'main'
export const latestVersion = 'v5'
export const availableVersions = ['v5', 'v4', 'v3']

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500'

export const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
  solid: { label: 'Solid', logo: solidLogo, value: 'solid' },
  vue: { label: 'Vue', logo: vueLogo, value: 'vue' },
  svelte: { label: 'Svelte', logo: svelteLogo, value: 'svelte' },
  angular: { label: 'Angular', logo: angularLogo, value: 'angular' },
} as const

export type Framework = keyof typeof frameworks

export const createLogo = (version?: string) => (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className="font-bold">
      <span className={`${gradientText}`}>Query</span>{' '}
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
      to: `https://github.com/${repo}`,
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

export const useQueryDocsConfig = (config: ConfigSchema) => {
  return useDocsConfig({
    config,
    frameworks,
    localMenu,
    availableVersions,
  })
}
