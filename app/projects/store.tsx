import { useMemo } from 'react'
import { Link, useMatches, useNavigate, useParams } from '@remix-run/react'
import { generatePath } from '~/utils/utils'
import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import angularLogo from '~/images/angular-logo.svg'
import { FaDiscord, FaGithub } from 'react-icons/fa/index'
import type { AvailableOptions } from '~/components/Select'
import type { ConfigSchema, MenuItem } from '~/utils/config'

export type Framework = 'angular' | 'react' | 'svelte' | 'vue' | 'solid'

export const repo = 'tanstack/store'

export const latestBranch = 'main'
export const latestVersion = 'v0'
export const availableVersions = ['v0']

export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-gray-700'

export const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
  solid: { label: 'Solid', logo: solidLogo, value: 'solid' },
  vue: { label: 'Vue', logo: vueLogo, value: 'vue' },
  svelte: { label: 'Svelte', logo: svelteLogo, value: 'svelte' },
  angular: { label: 'Angular', logo: angularLogo, value: 'angular' },
}

export const createLogo = (version?: string) => (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to="../../" className={`font-bold`}>
      <span className={`${gradientText}`}>Store</span>{' '}
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

export const useReactStoreDocsConfig = (config: ConfigSchema) => {
  const matches = useMatches()
  const match = matches[matches.length - 1]
  const params = useParams()
  const version = params.version!
  const framework =
    params.framework || localStorage.getItem('framework') || 'react'
  const navigate = useNavigate()

  const frameworkMenuItems =
    config.frameworkMenus?.find((d) => d.framework === framework)?.menuItems ??
    []

  const frameworkConfig = useMemo(() => {
    if (!config.frameworkMenus) {
      return undefined
    }

    const availableFrameworks = config.frameworkMenus?.reduce(
      (acc: AvailableOptions, menuEntry) => {
        acc[menuEntry.framework as string] =
          frameworks[menuEntry.framework as keyof typeof frameworks]
        return acc
      },
      { react: frameworks['react'] }
    )

    return {
      label: 'Framework',
      selected: framework!,
      available: availableFrameworks,
      onSelect: (option: { label: string; value: string }) => {
        const url = generatePath(match.id, {
          ...match.params,
          framework: option.value,
        })

        localStorage.setItem('framework', option.value)

        navigate(url)
      },
    }
  }, [config.frameworkMenus, framework, match, navigate])

  const versionConfig = useMemo(() => {
    const available = availableVersions.reduce(
      (acc: AvailableOptions, version) => {
        acc[version] = {
          label: version,
          value: version,
        }
        return acc
      },
      {
        latest: {
          label: 'Latest',
          value: 'latest',
        },
      }
    )

    return {
      label: 'Version',
      selected: version!,
      available,
      onSelect: (option: { label: string; value: string }) => {
        const url = generatePath(match.id, {
          ...match.params,
          version: option.value,
        })
        navigate(url)
      },
    }
  }, [version, match, navigate])

  const docSearch: NonNullable<ConfigSchema['docSearch']> =
    config.docSearch || {
      appId: '',
      apiKey: '',
      indexName: '',
    }

  return {
    ...config,
    docSearch,
    menu: [
      localMenu,
      // Merge the two menus together based on their group labels
      ...config.menu.map((d) => {
        const match = frameworkMenuItems.find((d2) => d2.label === d.label)
        return {
          label: d.label,
          children: [
            ...d.children.map((d) => ({ ...d, badge: 'core' })),
            ...(match?.children ?? []).map((d) => ({ ...d, badge: framework })),
          ],
        }
      }),
      ...frameworkMenuItems.filter(
        (d) => !config.menu.find((dd) => dd.label === d.label)
      ),
    ].filter(Boolean),
    frameworkConfig,
    versionConfig,
  }
}
