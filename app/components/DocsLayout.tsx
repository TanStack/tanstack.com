import * as React from 'react'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import {
  FaArrowLeft,
  FaArrowRight,
  FaDiscord,
  FaGithub,
  FaTimes,
} from 'react-icons/fa'
import {
  Link,
  useMatches,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import type { AnyOrama, SearchParamsFullText, AnyDocument } from '@orama/orama'
import { SearchBox, SearchButton } from '@orama/searchbox'
import { Carbon } from '~/components/Carbon'
import { Select } from '~/components/Select'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { DocsLogo } from '~/components/DocsLogo'
import { last, capitalize } from '~/utils/utils'
import type { SelectOption } from '~/components/Select'
import type { ConfigSchema, MenuItem } from '~/utils/config'
import { create } from 'zustand'
import { searchBoxParams, searchButtonParams } from '~/components/Orama'
import { Framework, getFrameworkOptions, getLibrary } from '~/libraries'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { DocsCalloutBytes } from '~/components/DocsCalloutBytes'
import { ClientOnlySearchButton } from './ClientOnlySearchButton'
import { twMerge } from 'tailwind-merge'

// Let's use zustand to wrap the local storage logic. This way
// we'll get subscriptions for free and we can use it in other
// components if we need to.
const useLocalCurrentFramework = create<{
  currentFramework?: string
  setCurrentFramework: (framework: string) => void
}>((set) => ({
  currentFramework:
    typeof document !== 'undefined'
      ? localStorage.getItem('framework') || undefined
      : undefined,
  setCurrentFramework: (framework: string) => {
    localStorage.setItem('framework', framework)
    set({ currentFramework: framework })
  },
}))

/**
 * Use framework in URL path
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
function useCurrentFramework(frameworks: Framework[]) {
  const navigate = useNavigate()

  const { framework: paramsFramework } = useParams({
    strict: false,
    experimental_returnIntersection: true,
  })

  const localCurrentFramework = useLocalCurrentFramework()

  let framework = (paramsFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  framework = frameworks.includes(framework) ? framework : 'react'

  const setFramework = React.useCallback(
    (framework: string) => {
      navigate({
        params: (prev: Record<string, string>) => ({
          ...prev,
          framework,
        }),
      })
      localCurrentFramework.setCurrentFramework(framework)
    },
    [localCurrentFramework, navigate]
  )

  React.useEffect(() => {
    // Set the framework in localStorage if it doesn't exist
    if (!localCurrentFramework.currentFramework) {
      localCurrentFramework.setCurrentFramework(framework)
    }

    // Set the framework in localStorage if it doesn't match the URL
    if (
      paramsFramework &&
      paramsFramework !== localCurrentFramework.currentFramework
    ) {
      localCurrentFramework.setCurrentFramework(paramsFramework)
    }
  })

  return {
    framework,
    setFramework,
  }
}

// Let's use zustand to wrap the local storage logic. This way
// we'll get subscriptions for free and we can use it in other
// components if we need to.
const useLocalCurrentVersion = create<{
  currentVersion?: string
  setCurrentVersion: (version: string) => void
}>((set) => ({
  currentVersion:
    typeof document !== 'undefined'
      ? localStorage.getItem('version') || undefined
      : undefined,
  setCurrentVersion: (version: string) => {
    localStorage.setItem('version', version)
    set({ currentVersion: version })
  },
}))

/**
 * Use framework in URL path
 * Otherwise use framework in localStorage if it exists for this project
 * Otherwise fallback to react
 */
function useCurrentVersion(versions: string[]) {
  const navigate = useNavigate()

  const { version: paramsVersion } = useParams({
    strict: false,
    experimental_returnIntersection: true,
  })

  const localCurrentVersion = useLocalCurrentVersion()

  let version = paramsVersion || localCurrentVersion.currentVersion || 'latest'

  version = versions.includes(version) ? version : 'latest'

  const setVersion = React.useCallback(
    (version: string) => {
      navigate({
        params: (prev: Record<string, string>) => ({
          ...prev,
          version,
        }),
      })
      localCurrentVersion.setCurrentVersion(version)
    },
    [localCurrentVersion, navigate]
  )

  React.useEffect(() => {
    // Set the version in localStorage if it doesn't exist
    if (!localCurrentVersion.currentVersion) {
      localCurrentVersion.setCurrentVersion(version)
    }

    // Set the version in localStorage if it doesn't match the URL
    if (paramsVersion && paramsVersion !== localCurrentVersion.currentVersion) {
      localCurrentVersion.setCurrentVersion(paramsVersion)
    }
  })

  return {
    version,
    setVersion,
  }
}

const useMenuConfig = ({
  config,
  repo,
  frameworks,
}: {
  config: ConfigSchema
  repo: string
  frameworks: Framework[]
}) => {
  const currentFramework = useCurrentFramework(frameworks)

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
        (f) => f.label === currentFramework.framework
      )
      const frameworkItems = frameworkDocs?.children ?? []

      const children = [
        ...section.children.map((d) => ({ ...d, badge: 'core' })),
        ...frameworkItems.map((d) => ({
          ...d,
          badge: currentFramework.framework,
        })),
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

const useFrameworkConfig = ({ frameworks }: { frameworks: Framework[] }) => {
  const currentFramework = useCurrentFramework(frameworks)

  const frameworkConfig = React.useMemo(() => {
    return {
      label: 'Framework',
      selected: frameworks.includes(currentFramework.framework)
        ? currentFramework.framework
        : 'react',
      available: getFrameworkOptions(frameworks),
      onSelect: (option: { label: string; value: string }) => {
        currentFramework.setFramework(option.value)
      },
    }
  }, [frameworks, currentFramework])

  return frameworkConfig
}

const useVersionConfig = ({ versions }: { versions: string[] }) => {
  const currentVersion = useCurrentVersion(versions)

  const versionConfig = React.useMemo(() => {
    const available = versions.reduce(
      (acc: SelectOption[], version) => {
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
      selected: versions.includes(currentVersion.version)
        ? currentVersion.version
        : 'latest',
      available,
      onSelect: (option: { label: string; value: string }) => {
        currentVersion.setVersion(option.value)
      },
    }
  }, [currentVersion, versions])

  return versionConfig
}

type DocsLayoutProps = {
  name: string
  version: string
  colorFrom: string
  colorTo: string
  textColor: string
  config: ConfigSchema
  frameworks: Framework[]
  versions: string[]
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
  versions,
  repo,
  children,
}: DocsLayoutProps) {
  const { libraryId } = useParams({
    strict: false,
    experimental_returnIntersection: true,
  })
  const frameworkConfig = useFrameworkConfig({ frameworks })
  const versionConfig = useVersionConfig({ versions })
  const menuConfig = useMenuConfig({ config, frameworks, repo })

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
        <div className="text-[.8em] uppercase font-black">{group?.label}</div>
        <div className="h-2" />
        <div className="ml-2 text-[.85em]">
          {group?.children?.map((child, i) => {
            const linkClasses = `cursor-pointer flex gap-2 items-center justify-between group px-2 py-[.1rem] rounded-lg hover:bg-gray-500 hover:bg-opacity-10`

            return (
              <React.Fragment key={i}>
                {child.to.startsWith('http') ? (
                  <a href={child.to} className={linkClasses}>
                    {child.label}
                  </a>
                ) : (
                  <Link
                    to={child.to}
                    params
                    onClick={() => {
                      detailsRef.current.removeAttribute('open')
                    }}
                    activeOptions={{
                      exact: true,
                    }}
                    className="!cursor-pointer relative"
                  >
                    {(props) => {
                      return (
                        <div className={twMerge(linkClasses)}>
                          <div
                            className={twMerge(
                              'overflow-auto w-full',
                              props.isActive
                                ? `font-bold text-transparent bg-clip-text bg-gradient-to-r ${colorFrom} ${colorTo}`
                                : ''
                            )}
                          >
                            {/* <div className="transition group-hover:delay-700 duration-300 group-hover:duration-[2s] group-hover:translate-x-[-50%]"> */}
                            {child.label}
                            {/* </div> */}
                          </div>
                          {child.badge ? (
                            <div
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
                                  : child.badge === 'qwik'
                                  ? 'text-indigo-500'
                                  : child.badge === 'vanilla'
                                  ? 'text-gray-300'
                                  : 'text-gray-500'
                              }`}
                            >
                              {child.badge}
                            </div>
                          ) : null}
                        </div>
                      )
                    }}
                  </Link>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    )
  })

  const oramaSearchParams: SearchParamsFullText<AnyOrama, AnyDocument> = {
    threshold: 0,
    where: {
      category: {
        eq: capitalize(libraryId),
      },
    },
  }

  const logo = (
    <DocsLogo
      name={name}
      linkTo={repo.replace('tanstack/', '')}
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
              selected={versionConfig.selected!}
              available={versionConfig.available}
              onSelect={versionConfig.onSelect}
            />
          </div>
          <ClientOnlySearchButton {...searchButtonParams} />
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div className="bg-white dark:bg-gray-900 shadow-xl max-w-[300px] xl:max-w-[350px] 2xl:max-w-[400px] hidden lg:flex flex-col gap-4 h-screen sticky top-0 z-20 dark:border-r border-gray-500/20 transition-all duration-500">
      <div
        className="px-4 pt-4 flex gap-2 items-center text-2xl"
        style={{
          viewTransitionName: `library-name`,
        }}
      >
        {logo}
      </div>
      <div className="px-4">
        <ClientOnlySearchButton {...searchButtonParams} />
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
          selected={versionConfig.selected!}
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
      className={`min-h-screen flex flex-col lg:flex-row w-full transition-all duration-300`}
    >
      <div className="fixed z-50">
        <SearchBox {...searchBoxParams} searchParams={oramaSearchParams} />
      </div>
      {smallMenu}
      {largeMenu}
      <div
        className={twMerge(
          `min-w-0 min-h-0 flex relative justify-center flex-1`,
          !isExample && 'mx-auto max-w-[900px]'
        )}
      >
        {children}
        <div
          className="fixed bottom-0 left-0 right-[70px]
                        lg:pl-[250px] z-10"
        >
          <div className="p-4 flex justify-center gap-4">
            {prevItem ? (
              <Link
                to={prevItem.to}
                params
                className="flex gap-2 items-center py-1 px-2 text-sm self-start rounded-md
                bg-white text-gray-600 dark:bg-black dark:text-gray-400
                shadow-lg dark:border dark:border-gray-800
                lg:text-lg"
              >
                <FaArrowLeft /> {prevItem.label}
              </Link>
            ) : null}
            {nextItem ? (
              <Link
                to={nextItem.to}
                params
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
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 dark:border-l border-gray-500/20 shadow-xl p-4 max-w-[240px] hidden md:block sticky top-0 max-h-screen overflow-auto">
        {libraryId === 'query' ? <DocsCalloutQueryGG /> : <DocsCalloutBytes />}
      </div>
      {showBytes ? (
        <div className="w-[300px] max-w-[350px] fixed md:hidden top-1/2 right-2 z-30 -translate-y-1/2 shadow-lg">
          <div className="bg-white dark:bg-gray-800 border border-black/10 dark:border-white/10 p-4 md:p-6 rounded-lg">
            {libraryId === 'query' ? (
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
            {libraryId === 'query' ? (
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
  )
}
