import * as React from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import {
  Link,
  json,
  useLoaderData,
  useMatches,
  useNavigate,
} from '@remix-run/react'
import { seo } from '~/utils/seo'
import type { DocsConfig } from '~/components/DocsLayout'
import { DocsLayout } from '~/components/DocsLayout'
import { QueryGGBanner } from '~/components/QueryGGBanner'
import {
  availableVersions,
  getBranch,
  gradientText,
  latestVersion,
  repo,
} from '~/projects/query'
import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import angularLogo from '~/images/angular-logo.svg'
import type { AvailableOptions } from '~/components/Select'
import { generatePath } from '~/utils/utils'
import { getTanstackDocsConfig, type MenuItem } from '~/utils/config'

export const loader = async (context: LoaderFunctionArgs) => {
  const { version, framework } = context.params
  const branch = getBranch(version)
  const tanstackDocsConfig = await getTanstackDocsConfig(repo, branch)

  return json({
    tanstackDocsConfig,
    framework,
    version,
  })
}

const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
  solid: { label: 'Solid', logo: solidLogo, value: 'solid' },
  vue: { label: 'Vue', logo: vueLogo, value: 'vue' },
  svelte: { label: 'Svelte', logo: svelteLogo, value: 'svelte' },
  angular: { label: 'Angular', logo: angularLogo, value: 'angular' },
}

const logo = (version?: string) => (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to=".." className={`font-bold`}>
      <span className={`${gradientText}`}>Query</span>{' '}
      <span className="text-sm align-super">
        {version === 'latest' ? latestVersion : version}
      </span>
    </Link>
  </>
)

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

export const meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Query Docs | React Query, Solid Query, Svelte Query, Vue Query',
  })
}

export default function RouteFrameworkParam() {
  const matches = useMatches()
  const match = matches[matches.length - 1]
  const navigate = useNavigate()
  const { tanstackDocsConfig, version, framework } =
    useLoaderData<typeof loader>()

  let config = tanstackDocsConfig

  const docsConfig = React.useMemo(() => {
    const frameworkMenu = config.frameworkMenus?.find(
      (d) => d.framework === framework
    )
    if (!frameworkMenu) return null
    return {
      ...config,
      menu: [localMenu, ...(frameworkMenu?.menuItems || [])],
    } as DocsConfig
  }, [framework, config])

  const frameworkConfig = React.useMemo(() => {
    if (!config.frameworkMenus) {
      return undefined
    }

    const availableFrameworks = config.frameworkMenus.reduce(
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
        navigate(url)
      },
    }
  }, [framework, match, navigate, config.frameworkMenus])

  const versionConfig = React.useMemo(() => {
    const available = availableVersions.reduce(
      (acc: AvailableOptions, version) => {
        acc[version.name] = {
          label: version.name,
          value: version.name,
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

  return (
    <>
      <QueryGGBanner />
      <DocsLayout
        logo={logo(version)}
        colorFrom={'from-rose-500'}
        colorTo={'to-violet-500'}
        textColor={'text-violet-500'}
        config={docsConfig!}
        framework={frameworkConfig}
        version={versionConfig}
      />
    </>
  )
}
