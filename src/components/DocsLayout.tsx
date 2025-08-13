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
import { FrameworkSelect } from '~/components/FrameworkSelect'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { DocsLogo } from '~/components/DocsLogo'
import { last } from '~/utils/utils'
import type { SelectOption } from '~/components/FrameworkSelect'
import type { ConfigSchema, MenuItem } from '~/utils/config'
import { create } from 'zustand'
import { Framework, getFrameworkOptions } from '~/libraries'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { DocsCalloutBytes } from '~/components/DocsCalloutBytes'
import { twMerge } from 'tailwind-merge'
import { partners } from '~/utils/partners'
import { GamFooter, GamLeftRailSquare, GamRightRailSquare } from './Gam'
import { AdGate } from '~/contexts/AdsContext'
import { SearchButton } from './SearchButton'

// Create context for width toggle state
const WidthToggleContext = React.createContext<{
  isFullWidth: boolean
  setIsFullWidth: (isFullWidth: boolean) => void
} | null>(null)

export const useWidthToggle = () => {
  const context = React.useContext(WidthToggleContext)
  if (!context) {
    throw new Error('useWidthToggle must be used within a WidthToggleProvider')
  }
  return context
}

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
  })

  const localCurrentFramework = useLocalCurrentFramework()

  let framework = (paramsFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  framework = frameworks.includes(framework) ? framework : 'react'

  const setFramework = React.useCallback(
    (framework: string) => {
      navigate({
        params: (prev) => ({
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
      ...(frameworks.length > 1
        ? [
            {
              label: 'Frameworks',
              to: './framework',
            },
          ]
        : []),
      {
        label: 'Contributors',
        to: '/$libraryId/$version/docs/contributors',
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
  const { _splat } = useParams({ strict: false })
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
  const [isFullWidth, setIsFullWidth] = useLocalStorage('docsFullWidth', false)

  const activePartners = partners.filter(
    (d) => d.libraries?.includes(libraryId as any) && d.status === 'active'
  )

  const menuItems = menuConfig.map((group, i) => {
    const WrapperComp = group.collapsible ? 'details' : 'div'
    const LabelComp = group.collapsible ? 'summary' : 'div'

    const isChildActive = group.children.some((d) => d.to === _splat)
    const configGroupOpenState =
      typeof group.defaultCollapsed !== 'undefined'
        ? !group.defaultCollapsed // defaultCollapsed is true means the group is closed
        : undefined
    const isOpen = isChildActive ? true : configGroupOpenState ?? false

    const detailsProps = group.collapsible ? { open: isOpen } : {}

    return (
      <WrapperComp
        key={`group-${i}`}
        className="[&>summary]:before:mr-[0.4rem] [&>summary]:marker:text-[0.8em] [&>summary]:marker:-ml-[0.3rem] [&>summary]:marker:leading-4 [&>div.ts-sidebar-label]:ml-4 relative select-none"
        {...detailsProps}
      >
        <LabelComp className="text-[.8em] uppercase font-black leading-4 ts-sidebar-label">
          {group?.label}
        </LabelComp>
        <div className="h-2" />
        <ul className="ml-2 text-[.85em] leading-6 list-none">
          {group?.children?.map((child, i) => {
            const linkClasses = `flex gap-2 items-center justify-between group px-2 py-[.1rem] rounded-lg hover:bg-gray-500/10`

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
                      includeHash: false,
                      includeSearch: false,
                    }}
                    className="relative"
                  >
                    {(props) => {
                      return (
                        <div className={twMerge(linkClasses)}>
                          <div
                            className={twMerge(
                              'overflow-auto w-full',
                              props.isActive
                                ? `font-bold text-transparent bg-clip-text bg-linear-to-r ${colorFrom} ${colorTo}`
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
      libraryId={libraryId}
      version={version}
      colorFrom={colorFrom}
      colorTo={colorTo}
    />
  )

  const smallMenu = (
    <div className="lg:hidden bg-white/50 sticky top-0 z-20 dark:bg-black/60 backdrop-blur-lg">
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500/20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex-1 flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
        </summary>
        <div className="flex flex-col gap-4 p-4 whitespace-nowrap overflow-y-auto border-t border-gray-500/20 bg-white/20 text-lg dark:bg-black/20">
          <div className="flex gap-4">
            <FrameworkSelect
              label={frameworkConfig.label}
              selected={frameworkConfig.selected}
              available={frameworkConfig.available}
              onSelect={frameworkConfig.onSelect}
            />
            <FrameworkSelect
              label={versionConfig.label}
              selected={versionConfig.selected!}
              available={versionConfig.available}
              onSelect={versionConfig.onSelect}
            />
          </div>
          <SearchButton />
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div className="bg-white/50 dark:bg-black/30 shadow-xl max-w-[300px] xl:max-w-[350px] 2xl:max-w-[400px] hidden lg:flex flex-col gap-4 h-screen sticky top-0 z-20 dark:border-r border-gray-500/20 transition-all duration-500">
      <div
        className="px-4 pt-4 flex gap-2 items-center text-2xl"
        style={{
          viewTransitionName: `library-name`,
        }}
      >
        {logo}
      </div>
      <div className="px-4">
        <SearchButton />
      </div>
      <div className="flex gap-2 px-4">
        <FrameworkSelect
          className="flex-[3_1_0%]"
          label={frameworkConfig.label}
          selected={frameworkConfig.selected}
          available={frameworkConfig.available}
          onSelect={frameworkConfig.onSelect}
        />
        <FrameworkSelect
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
    <WidthToggleContext.Provider value={{ isFullWidth, setIsFullWidth }}>
      <div
        className={`min-h-screen flex flex-col lg:flex-row w-full transition-all duration-300`}
      >
        {smallMenu}
        {largeMenu}
        <div className="flex flex-col max-w-full min-w-0 w-full min-h-0 relative mb-8">
          <div
            className={twMerge(
              `max-w-full min-w-0 flex justify-center w-full min-h-[88dvh] lg:min-h-0`,
              !isExample && !isFullWidth && 'mx-auto w-[1208px]' // page width
            )}
          >
            {children}
          </div>
          <AdGate>
            <div className="mb-8 !py-0! mx-auto max-w-full overflow-x-hidden">
              <GamFooter />
            </div>
          </AdGate>
          <div className="sticky flex items-center flex-wrap bottom-2 z-10 right-0 text-xs md:text-sm px-1 print:hidden">
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
                      className={`bg-linear-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent`}
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
        <div className="-ml-2 pl-2 w-full lg:w-[340px] shrink-0 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:overflow-x-hidden">
          <div className="ml-auto flex flex-wrap flex-row justify-center lg:flex-col gap-4">
            <div className="min-w-[250px] bg-white dark:bg-black/40 border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border border-r-0 border-t-0 rounded-bl-lg">
              <div className="uppercase font-black text-center p-3 opacity-50">
                Our Partners
              </div>
              {!activePartners?.length ? (
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
                activePartners
                  .filter((d) => d.sidebarImgLight)
                  .map((partner) => {
                    return (
                      <div
                        key={partner.name}
                        className="overflow-hidden hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors"
                      >
                        <a
                          href={partner.href}
                          target="_blank"
                          className="px-4 flex flex-col items-center justify-center cursor-pointer gap-1"
                          rel="noreferrer"
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
                                partner.sidebarImgDark ||
                                partner.sidebarImgLight
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
            {libraryId === 'query' ? (
              <div className="p-4 bg-white dark:bg-black/40 border-b border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border-t border-l rounded-l-lg">
                <DocsCalloutQueryGG />
              </div>
            ) : null}

            <AdGate>
              <div className="bg-white dark:bg-black/40 border-gray-500/20 shadow-xl flex flex-col border-t border-l border-b p-2 space-y-2 rounded-l-lg">
                <GamRightRailSquare />
              </div>
            </AdGate>

            <AdGate>
              <div className="bg-white dark:bg-black/40 border-gray-500/20 shadow-xl flex flex-col border-t border-l border-b p-2 space-y-2 rounded-l-lg">
                <GamLeftRailSquare />
              </div>
            </AdGate>

            {/* <div className="bg-white dark:bg-black/40 border-gray-500/20 shadow-xl flex flex-col border-t border-l border-b p-4 space-y-2 rounded-l-lg">
              <Carbon />
            </div> */}

            {libraryId !== 'query' ? (
              <div className="p-4 bg-white dark:bg-black/40 border-b border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border-t border-l rounded-l-lg">
                <DocsCalloutBytes />
              </div>
            ) : null}
          </div>
        </div>
        {showBytes ? (
          <div className="w-[300px] max-w-[350px] fixed md:hidden top-1/2 right-2 z-30 -translate-y-1/2 shadow-lg print:hidden">
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
            className="right-0 top-1/2 -translate-y-[50px] fixed lg:hidden print:hidden"
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
    </WidthToggleContext.Provider>
  )
}
