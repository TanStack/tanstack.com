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
} from '@tanstack/react-router'
import { OramaSearchBox } from '@orama/react-components'
import { Carbon } from '~/components/Carbon'
import { Select } from '~/components/Select'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { DocsLogo } from '~/components/DocsLogo'
import { last, capitalize } from '~/utils/utils'
import type { SelectOption } from '~/components/Select'
import type { ConfigSchema, MenuItem } from '~/utils/config'
import { create } from 'zustand'
import { searchBoxParams, searchButtonParams } from '~/components/Orama'
import { Framework, getFrameworkOptions } from '~/libraries'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { DocsCalloutBytes } from '~/components/DocsCalloutBytes'
import { ClientOnlySearchButton } from './ClientOnlySearchButton'
import { twMerge } from 'tailwind-merge'
import { partners } from '~/utils/partners'

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
}): MenuItem[] => {
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
    ...config.sections.map((section): MenuItem | undefined => {
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
        collapsible: section.collapsible ?? false,
        defaultCollapsed: section.defaultCollapsed ?? false,
      }
    }),
  ].filter((item) => item !== undefined)
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
    from: '/$libraryId/$version/docs',
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

  const [isSearchboxOpen, setIsSearchboxOpen] = React.useState(false)

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
    const WrapperComp = group.collapsible ? 'details' : 'div'
    const LabelComp = group.collapsible ? 'summary' : 'div'

    const isCollapsed = group.defaultCollapsed ?? false

    const detailsProps = group.collapsible ? { open: !isCollapsed } : {}

    return (
      <WrapperComp
        key={`group-${i}`}
        className="[&>summary]:before:mr-[0.4rem] [&>summary]:marker:text-[0.8em] [&>summary]:marker:-ml-[0.3rem] [&>summary]:marker:leading-4 [&>div.ts-sidebar-label]:ml-[1rem] relative select-none"
        {...detailsProps}
      >
        <LabelComp className="text-[.8em] uppercase font-black leading-4 ts-sidebar-label">
          {group?.label}
        </LabelComp>
        <div className="h-2" />
        <ul className="ml-2 text-[.85em] list-none">
          {group?.children?.map((child, i) => {
            const linkClasses = `cursor-pointer flex gap-2 items-center justify-between group px-2 py-[.1rem] rounded-lg hover:bg-gray-500 hover:bg-opacity-10`

            return (
              <li key={i}>
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
                                  : child.badge === 'lit'
                                  ? 'text-emerald-500'
                                  : child.badge === 'vanilla'
                                  ? 'text-yellow-500'
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
              </li>
            )
          })}
        </ul>
      </WrapperComp>
    )
  })

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
              dark:bg-gray-900"
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
          <ClientOnlySearchButton
            {...searchButtonParams}
            onClick={() => setIsSearchboxOpen(true)}
          >
            Search
          </ClientOnlySearchButton>
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
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base pb-8">
        {menuItems}
      </div>
    </div>
  )

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row w-full transition-all duration-300`}
    >
      <div className="fixed z-50">
        <OramaSearchBox
          {...searchBoxParams}
          searchParams={{
            threshold: 0,
            where: {
              category: {
                eq: capitalize(libraryId!) as string,
              },
            } as any,
          }}
          facetProperty={undefined}
          open={isSearchboxOpen}
          onSearchboxClosed={() => setIsSearchboxOpen(false)}
        />
      </div>
      {smallMenu}
      {largeMenu}
      <div
        className={twMerge(
          `max-w-full min-w-0 flex relative justify-center w-full min-h-[88dvh] lg:min-h-0`,
          !isExample && 'mx-auto w-[900px]'
        )}
      >
        {children}
        <div className="fixed flex items-center flex-wrap bottom-2 left-0 lg:left-[250px] z-10 right-0 text-xs md:text-sm px-1">
          <div className="w-1/2 px-1 flex justify-end flex-wrap">
            {prevItem ? (
              <Link
                to={prevItem.to}
                params
                className="py-1 px-2 bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-lg shadow-black/20 flex items-center justify-center backdrop-blur-sm z-20 rounded-lg overflow-hidden"
              >
                <div className="flex gap-2 items-center font-bold">
                  <FaArrowLeft />
                  {prevItem.label}
                </div>
              </Link>
            ) : null}
          </div>
          <div className="w-1/2 px-1 flex justify-start flex-wrap">
            {nextItem ? (
              <Link
                to={nextItem.to}
                params
                className="py-1 px-2 bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-lg shadow-black/20 flex items-center justify-center backdrop-blur-sm z-20 rounded-lg overflow-hidden"
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
      <div className="-ml-2 pl-2 w-64 hidden md:block sticky top-0 max-h-screen overflow-y-auto">
        <div className="ml-auto flex flex-col space-y-4">
          <div className="bg-white dark:bg-gray-900 border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border border-r-0 border-t-0 rounded-bl-lg">
            <div className="uppercase font-black text-center p-3 opacity-50">
              Our Partners
            </div>
            {!partners.some((d) => d.libraries?.includes(libraryId as any)) ? (
              <div className="hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors">
                <a
                  href={`mailto:partners@tanstack.com?subject=TanStack ${
                    repo.split('/')[1]
                  } Partnership`}
                  className="p-2 block text-xs"
                >
                  <span className="opacity-50 italic">
                    Wow, it looks like you could be our first partner for this
                    library!
                  </span>{' '}
                  <span className="text-blue-500 font-black">
                    Chat with us!
                  </span>
                </a>
              </div>
            ) : (
              partners
                .filter((d) => d.sidebarImgLight)
                .filter((d) => d.libraries?.includes(libraryId as any))
                .map((partner) => {
                  return (
                    <div
                      key={partner.name}
                      className="overflow-hidden hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors"
                    >
                      <a
                        href={partner.href}
                        target="_blank"
                        className="px-4 flex items-center justify-center cursor-pointer"
                      >
                        <div className="mx-auto max-w-[150px]">
                          <img
                            src={partner.sidebarImgLight}
                            alt={partner.name}
                            className={twMerge(
                              'w-full',
                              partner.sidebarImgClass,
                              'dark:hidden'
                            )}
                          />
                          <img
                            src={
                              partner.sidebarImgDark || partner.sidebarImgLight
                            }
                            alt={partner.name}
                            className={twMerge(
                              'w-full',
                              partner.sidebarImgClass,
                              'hidden dark:block'
                            )}
                          />
                        </div>
                      </a>
                    </div>
                  )
                })
            )}
          </div>
          <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border-t border-l rounded-l-lg">
            {libraryId === 'query' ? (
              <DocsCalloutQueryGG />
            ) : (
              <DocsCalloutBytes />
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 border-gray-500/20 shadow-xl flex flex-col border-t border-l border-b p-4 space-y-2 rounded-l-lg">
            <Carbon />
            <div
              className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500 italic
                dark:bg-opacity-20 self-center opacity-50 hover:opacity-100 transition-opacity"
            >
              This ad helps to keep us from burning out and rage-quitting OSS
              just *that* much more, so chill. 😉
            </div>
          </div>
        </div>
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
          className="right-0 top-1/2 -translate-y-[50px] fixed lg:hidden"
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
