import { useMemo } from 'react'
import { useMatches, useNavigate, useParams } from '@remix-run/react'
import { z } from 'zod'
import { fetchRepoFile } from './documents.server'
import { generatePath } from '~/utils/utils'
import type { AvailableOptions } from '~/components/Select'

export type FrameworkMenu = {
  framework: string
  menuItems: MenuItem[]
}

export type MenuItem = {
  label: string | React.ReactNode
  children: {
    label: string | React.ReactNode
    to: string
    badge?: string
  }[]
}

const menuItemSchema = z.object({
  label: z.string(),
  children: z.array(
    z.object({
      label: z.string(),
      to: z.string(),
      badge: z.string().optional(),
    })
  ),
})

const frameworkMenuSchema = z.object({
  framework: z.string(),
  menuItems: z.array(menuItemSchema),
})

const configSchema = z.object({
  docSearch: z.object({
    appId: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
  }),
  menu: z.array(menuItemSchema),
  frameworkMenus: z.array(frameworkMenuSchema),
  users: z.array(z.string()).optional(),
})

export type ConfigSchema = z.infer<typeof configSchema>

/**
  Fetch the config file for the project and validate it.
  */
export async function getTanstackDocsConfig(repo: string, branch: string) {
  const config = await fetchRepoFile(repo, branch, `docs/config.json`)

  if (!config) {
    throw new Error('Repo docs/config.json not found!')
  }

  try {
    const tanstackDocsConfigFromJson = JSON.parse(config)
    const validationResult = configSchema.safeParse(tanstackDocsConfigFromJson)

    if (!validationResult.success) {
      // Log the issues that come up during validation
      console.error(JSON.stringify(validationResult.error, null, 2))
      throw new Error('Zod validation failed')
    }

    return validationResult.data
  } catch (e) {
    throw new Error('Invalid docs/config.json file')
  }
}

/**
 * Use framework in URL path
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
export function useCurrentFramework(frameworks: AvailableOptions) {
  const { framework: paramsFramework } = useParams()
  const localStorageFramework = localStorage.getItem('framework')

  return paramsFramework
    ? paramsFramework
    : localStorageFramework
    ? frameworks[localStorageFramework]
      ? localStorageFramework
      : 'react'
    : 'react'
}

export const useDocsConfig = ({
  config,
  frameworks,
  availableVersions,
  localMenu,
}: {
  config: ConfigSchema
  frameworks: AvailableOptions
  availableVersions: string[]
  localMenu: MenuItem
}) => {
  const matches = useMatches()
  const match = matches[matches.length - 1]
  const params = useParams()
  const version = params.version!
  const framework = useCurrentFramework(frameworks)
  const navigate = useNavigate()

  const frameworkMenuItems =
    config.frameworkMenus.find((d) => d.framework === framework)?.menuItems ??
    []

  const frameworkConfig = useMemo(() => {
    return {
      label: 'Framework',
      selected: frameworks[framework] ? framework : 'react',
      available: frameworks,
      onSelect: (option: { label: string; value: string }) => {
        const url = generatePath(match.id, {
          ...match.params,
          framework: option.value,
        })

        localStorage.setItem('framework', option.value)

        navigate(url)
      },
    }
  }, [frameworks, framework, match, navigate])

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
      selected: version,
      available,
      onSelect: (option: { label: string; value: string }) => {
        const url = generatePath(match.id, {
          ...match.params,
          version: option.value,
        })
        navigate(url)
      },
    }
  }, [version, match, navigate, availableVersions])

  return {
    ...config,
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

export type DocsConfig = ReturnType<typeof useDocsConfig>
