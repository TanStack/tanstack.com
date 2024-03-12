import { DocSearch } from '@docsearch/react'
import * as React from 'react'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import {
  FaArrowLeft,
  FaArrowRight,
  FaDiscord,
  FaGithub,
  FaTimes,
} from 'react-icons/fa'
import { NavLink, useMatches, useNavigate, useParams } from '@remix-run/react'
import { Carbon } from '~/components/Carbon'
import { LinkOrA } from '~/components/LinkOrA'
import { Search } from '~/components/Search'
import { Select } from '~/components/Select'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { DocsCalloutBytes } from '~/components/DocsCalloutBytes'
import { DocsLogo } from '~/components/DocsLogo'
import { generatePath, last } from '~/utils/utils'
import type { AvailableOptions } from '~/components/Select'
import type { ConfigSchema, MenuItem } from '~/utils/config'

/**
 * Use framework in URL path
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
function useCurrentFramework(frameworks: AvailableOptions) {
  const { framework: paramsFramework } = useParams()
  const localStorageFramework = localStorage.getItem('framework')

  return (
    paramsFramework ||
    (localStorageFramework &&
    frameworks.find(({ value }) => localStorageFramework === value)
      ? localStorageFramework
      : 'react')
  )
}

const useMenuConfig = ({
  config,
  framework,
  repo,
}: {
  config: ConfigSchema
  framework: string
  repo: string
}) => {
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

  return [
    localMenu,
    // Merge the two menus together based on their group labels
    ...config.sections.map((section) => {
      const frameworkDocs = section.frameworks?.find(
        (f) => f.label === framework
      )
      const frameworkItems = frameworkDocs?.children ?? []

      const children = [
        ...section.children.map((d) => ({ ...d, badge: 'core' })),
        ...frameworkItems.map((d) => ({ ...d, badge: framework })),
      ]

      if (children.length === 0) {
        return undefined
      }

      return {
        label: section.label,
        children,
      }
    }),
  ].filter(Boolean)
}

const useFrameworkConfig = ({
  framework,
  frameworks,
}: {
  framework: string
  frameworks: AvailableOptions
}) => {
  const matches = useMatches()
  const match = matches[matches.length - 1]
  const navigate = useNavigate()

  const frameworkConfig = React.useMemo(() => {
    return {
      label: 'Framework',
      selected: framework,
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

  return frameworkConfig
}

const useVersionConfig = ({
  availableVersions,
}: {
  availableVersions: string[]
}) => {
  const matches = useMatches()
  const match = matches[matches.length - 1]
  const params = useParams()
  const version = params.version!
  const navigate = useNavigate()

  const versionConfig = React.useMemo(() => {
    const available = availableVersions.reduce(
      (acc: AvailableOptions, version) => {
        acc.push({
          label: version,
          value: version,
        })
        return acc
      },
      [
        {
          label: 'Latest',
          value: 'latest',
        },
      ]
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

  return versionConfig
}

type DocsLayoutProps = {
  name: string
  version: string
  colorFrom: string
  colorTo: string
  textColor: string
  config: ConfigSchema
  frameworks: AvailableOptions
  availableVersions: string[]
  repo: string
  children: React.ReactNode
}

export function DocsLayout({
  name,
  version,
  colorFrom,
  colorTo,
  textColor,
  config,
  frameworks,
  availableVersions,
  repo,
  children,
}: DocsLayoutProps) {
  const framework = useCurrentFramework(frameworks)
  const frameworkConfig = useFrameworkConfig({ framework, frameworks })
  const versionConfig = useVersionConfig({ availableVersions })
  const menuConfig = useMenuConfig({ config, framework, repo })

  const matches = useMatches()
  const lastMatch = last(matches)

  const isExample = matches.some((d) => d.pathname.includes('/examples/'))

  const detailsRef = React.useRef<HTMLElement>(null!)

  const flatMenu = React.useMemo(
    () => menuConfig.flatMap((d) => d?.children),
    [menuConfig]
  )

  const docsMatch = matches.find((d) => d.pathname.includes('/docs'))

  const relativePathname = lastMatch.pathname.replace(
    docsMatch!.pathname + '/',
    ''
  )

  const index = flatMenu.findIndex((d) => d?.to === relativePathname)
  const prevItem = flatMenu[index - 1]
  const nextItem = flatMenu[index + 1]

  const [showBytes, setShowBytes] = useLocalStorage('showBytes', true)

  const menuItems = menuConfig.map((group, i) => {
    return (
      <div key={i}>
        <div className="text-[.9em] uppercase font-black">{group?.label}</div>
        <div className="h-2" />
        <div className="ml-2 space-y-px text-[.9em]">
          {group?.children?.map((child, i) => {
            const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500 hover:bg-opacity-10`

            return (
              <div key={i}>
                {child.to.startsWith('http') ? (
                  <a href={child.to} className={linkClasses}>
                    {child.label}
                  </a>
                ) : (
                  <NavLink
                    to={child.to}
                    onClick={() => {
                      detailsRef.current.removeAttribute('open')
                    }}
                    end
                  >
                    {(props) => {
                      return (
                        <div className={linkClasses}>
                          <span
                            className={
                              props.isActive
                                ? `font-bold text-transparent bg-clip-text bg-gradient-to-r ${colorFrom} ${colorTo}`
                                : ''
                            }
                          >
                            {child.label}
                          </span>
                          {child.badge ? (
                            <span
                              className={`text-xs ${
                                props.isActive ? 'opacity-100' : 'opacity-40'
                              } group-hover:opacity-100 font-bold transition-opacity ${
                                child.badge === 'react'
                                  ? 'text-sky-500'
                                  : child.badge === 'solid'
                                  ? 'text-blue-500'
                                  : child.badge === 'svelte'
                                  ? 'text-orange-500'
                                  : child.badge === 'vue'
                                  ? 'text-green-500'
                                  : child.badge === 'angular'
                                  ? 'text-fuchsia-500'
                                  : 'text-gray-500'
                              }`}
                            >
                              {child.badge}
                            </span>
                          ) : null}
                        </div>
                      )
                    }}
                  </NavLink>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  })

  const logo = (
    <DocsLogo
      name={name}
      version={version}
      colorFrom={colorFrom}
      colorTo={colorTo}
    />
  )

  const smallMenu = (
    <div
      className="lg:hidden bg-white sticky top-0 z-20
              dark:bg-black"
    >
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500 border-opacity-20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
          <Search {...config.docSearch} />
        </summary>
        <div
          className="flex flex-col gap-4 p-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          <div className="flex gap-4">
            <Select
              label={frameworkConfig.label}
              selected={frameworkConfig.selected}
              available={frameworkConfig.available}
              onSelect={frameworkConfig.onSelect}
            />
            <Select
              label={versionConfig.label}
              selected={versionConfig.selected}
              available={versionConfig.available}
              onSelect={versionConfig.onSelect}
            />
          </div>
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div className="min-w-[250px] hidden lg:flex flex-col gap-4 h-screen sticky top-0 z-20">
      <div className="px-4 pt-4 flex gap-2 items-center text-2xl">{logo}</div>
      <div>
        <DocSearch
          appId={config.docSearch.appId}
          indexName={config.docSearch.indexName}
          apiKey={config.docSearch.apiKey}
        />
      </div>
      <div className="flex gap-2 px-4">
        <Select
          className="flex-[3_1_0%]"
          label={frameworkConfig.label}
          selected={frameworkConfig.selected}
          available={frameworkConfig.available}
          onSelect={frameworkConfig.onSelect}
        />
        <Select
          className="flex-[2_1_0%]"
          label={versionConfig.label}
          selected={versionConfig.selected}
          available={versionConfig.available}
          onSelect={versionConfig.onSelect}
        />
      </div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base pb-[300px]">
        {menuItems}
      </div>
      <div className="carbon-small absolute bottom-0 w-full">
        <Carbon />
      </div>
    </div>
  )

  return (
    <div
      className={`min-h-screen mx-auto flex flex-col lg:flex-row w-full transition-all duration-300 ${
        isExample ? 'max-w-[2560px]' : 'max-w-[1400px]'
      }`}
    >
      {smallMenu}
      {largeMenu}
      <div className="flex w-full lg:w-[calc(100%-250px)] flex-1">
        <div className="min-w-0 min-h-0 flex relative justify-center flex-1">
          {children}
          <div
            className="fixed bottom-0 left-0 right-0
                        lg:pl-[250px] z-10"
          >
            <div className="p-4 flex justify-center gap-4">
              {prevItem ? (
                <LinkOrA
                  to={prevItem.to}
                  className="flex gap-2 items-center py-1 px-2 text-sm self-start rounded-md
                bg-white text-gray-600 dark:bg-black dark:text-gray-400
                shadow-lg dark:border dark:border-gray-800
                lg:text-lg"
                >
                  <FaArrowLeft /> {prevItem.label}
                </LinkOrA>
              ) : null}
              {nextItem ? (
                <LinkOrA
                  to={nextItem.to}
                  className="py-1 px-2 text-sm self-end rounded-md
                  bg-white dark:bg-black
                  shadow-lg dark:border dark:border-gray-800
                  lg:text-lg
                  "
                >
                  <div className="flex gap-2 items-center font-bold">
                    <span
                      className={`bg-gradient-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent`}
                    >
                      {nextItem.label}
                    </span>{' '}
                    <FaArrowRight className={textColor} />
                  </div>
                </LinkOrA>
              ) : null}
            </div>
          </div>
        </div>
        <div className="p-4 max-w-[240px] shrink-0 border-l border-gray-200 dark:border-white/10 hidden md:block">
          {config?.docSearch?.indexName?.includes('query') ? (
            <DocsCalloutQueryGG />
          ) : (
            <DocsCalloutBytes />
          )}
        </div>
        {showBytes ? (
          <div className="w-[300px] max-w-[350px] fixed md:hidden top-1/2 right-2 z-30 -translate-y-1/2 shadow-lg">
            <div className="bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 p-4 md:p-6 rounded-lg">
              {config?.docSearch?.indexName?.includes('query') ? (
                <DocsCalloutQueryGG />
              ) : (
                <DocsCalloutBytes />
              )}
              <button
                className="absolute top-0 right-0 p-2 hover:text-red-500 opacity:30 hover:opacity-100"
                onClick={() => {
                  setShowBytes(false)
                }}
              >
                <FaTimes />
              </button>
            </div>
          </div>
        ) : (
          <button
            className="right-0 top-1/2 -translate-y-[50px] fixed md:hidden"
            onClick={() => {
              setShowBytes(true)
            }}
          >
            <div
              className="origin-bottom-right -rotate-90 text-xs bg-white dark:bg-gray-800 border border-gray-100
            hover:bg-rose-600 hover:text-white p-1 px-2 rounded-t-md shadow-md dark:border-0"
            >
              {config?.docSearch?.indexName?.includes('query') ? (
                <>
                  <strong>
                    <span role="img" aria-label="crystal ball">
                      &#128302;
                    </span>{' '}
                    Skip the docs?
                  </strong>
                </>
              ) : (
                <>
                  Subscribe to <strong>Bytes</strong>
                </>
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
