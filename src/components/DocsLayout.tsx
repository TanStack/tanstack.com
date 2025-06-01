import {
  Link,
  useMatches,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import { DocsCalloutBytes } from '~/components/DocsCalloutBytes'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { DocsLogo } from '~/components/DocsLogo'
import { FrameworkSelect } from '~/components/FrameworkSelect'
import type { SelectOption } from '~/components/FrameworkSelect'
import { Framework, getFrameworkOptions } from '~/libraries'
import type { ConfigSchema, MenuItem } from '~/utils/config'
import { partners } from '~/utils/partners'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { capitalize, last } from '~/utils/utils'
import * as React from 'react'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import {
  FaArrowLeft,
  FaArrowRight,
  FaDiscord,
  FaGithub,
  FaTimes,
} from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'
import { create } from 'zustand'
import {
  GadFooter,
  GadLeftRailSquare,
  GadRightRailSquare,
} from './GoogleScripts'
import { SearchButton } from './SearchButton'
import { useThemeStore } from './ThemeToggle'

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
    [localCurrentFramework, navigate],
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
    [localCurrentVersion, navigate],
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
        (f) => f.label === currentFramework.framework,
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
      ],
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
    [menuConfig],
  )

  const docsMatch = matches.find((d) => d.pathname.includes('/docs'))

  const relativePathname = lastMatch.pathname.replace(
    docsMatch!.pathname + '/',
    '',
  )

  const index = flatMenu.findIndex((d) => d?.to === relativePathname)
  const prevItem = flatMenu[index - 1]
  const nextItem = flatMenu[index + 1]

  const [showBytes, setShowBytes] = useLocalStorage('showBytes', true)

  const footerAdKey = useRouterState({ select: (d) => d.location.pathname })

  const menuItems = menuConfig.map((group, i) => {
    const WrapperComp = group.collapsible ? 'details' : 'div'
    const LabelComp = group.collapsible ? 'summary' : 'div'

    const isChildActive = group.children.some((d) => d.to === _splat)
    const configGroupOpenState =
      typeof group.defaultCollapsed !== 'undefined'
        ? !group.defaultCollapsed // defaultCollapsed is true means the group is closed
        : undefined
    const isOpen = isChildActive ? true : (configGroupOpenState ?? false)

    const detailsProps = group.collapsible ? { open: isOpen } : {}

    return (
      <WrapperComp
        key={`group-${i}`}
        className="relative select-none [&>div.ts-sidebar-label]:ml-[1rem] [&>summary]:marker:-ml-[0.3rem] [&>summary]:marker:text-[0.8em] [&>summary]:marker:leading-4 [&>summary]:before:mr-[0.4rem]"
        {...detailsProps}
      >
        <LabelComp className="ts-sidebar-label text-[.8em] leading-4 font-black uppercase">
          {group?.label}
        </LabelComp>
        <div className="h-2" />
        <ul className="ml-2 list-none text-[.85em]">
          {group?.children?.map((child, i) => {
            const linkClasses = `cursor-pointer flex gap-2 items-center justify-between group px-2 py-[.1rem] rounded-lg hover:bg-gray-500/10`

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
                    className="relative !cursor-pointer"
                  >
                    {(props) => {
                      return (
                        <div className={twMerge(linkClasses)}>
                          <div
                            className={twMerge(
                              'w-full overflow-auto',
                              props.isActive
                                ? `bg-gradient-to-r bg-clip-text font-bold text-transparent ${colorFrom} ${colorTo}`
                                : '',
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
                              } font-bold transition-opacity group-hover:opacity-100 ${
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
    <div className="sticky top-0 z-20 bg-white/50 backdrop-blur-lg lg:hidden dark:bg-black/60">
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500/20"
      >
        <summary className="flex items-center justify-between gap-2 p-4">
          <div className="flex flex-1 items-center gap-2 text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
        </summary>
        <div className="flex flex-col gap-4 overflow-y-auto border-t border-gray-500/20 bg-white/20 p-4 text-lg whitespace-nowrap dark:bg-black/20">
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
    <div className="sticky top-0 z-20 hidden h-screen max-w-[300px] flex-col gap-4 border-gray-500/20 bg-white/50 shadow-xl transition-all duration-500 lg:flex xl:max-w-[350px] 2xl:max-w-[400px] dark:border-r dark:bg-black/30">
      <div
        className="flex items-center gap-2 px-4 pt-4 text-2xl"
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
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-8 text-base whitespace-nowrap">
        {menuItems}
      </div>
    </div>
  )

  return (
    <div
      className={`flex min-h-screen w-full flex-col transition-all duration-300 lg:flex-row`}
    >
      {smallMenu}
      {largeMenu}
      <div className="relative flex min-h-0 w-full max-w-full min-w-0 flex-col">
        <div
          className={twMerge(
            `flex min-h-[88dvh] w-full max-w-full min-w-0 justify-center lg:min-h-0`,
            !isExample && 'mx-auto w-[1208px]',
          )}
        >
          {children}
        </div>
        <div
          className="mx-auto mb-8 max-w-full overflow-x-hidden !py-0"
          key={footerAdKey}
        >
          <GadFooter />
        </div>
        <div className="sticky right-0 bottom-4 z-10 flex flex-wrap items-center px-1 text-xs md:text-sm print:hidden">
          <div className="flex w-1/2 flex-wrap justify-end px-1">
            {prevItem ? (
              <Link
                to={prevItem.to}
                params
                className="z-20 flex items-center justify-center overflow-hidden rounded-lg bg-white/70 px-2 py-1 text-black shadow-lg shadow-black/20 backdrop-blur-sm dark:bg-gray-500/40 dark:text-white"
              >
                <div className="flex items-center gap-2 font-bold">
                  <FaArrowLeft />
                  {prevItem.label}
                </div>
              </Link>
            ) : null}
          </div>
          <div className="flex w-1/2 flex-wrap justify-start px-1">
            {nextItem ? (
              <Link
                to={nextItem.to}
                params
                className="z-20 flex items-center justify-center overflow-hidden rounded-lg bg-white/70 px-2 py-1 text-black shadow-lg shadow-black/20 backdrop-blur-sm dark:bg-gray-500/40 dark:text-white"
              >
                <div className="flex items-center gap-2 font-bold">
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
      <div className="sticky top-0 -ml-2 hidden max-h-screen w-[290px] shrink-0 overflow-y-auto pl-2 md:block xl:w-[340px]">
        <div className="ml-auto flex flex-col space-y-4">
          <div className="flex flex-col divide-y divide-gray-500/20 rounded-bl-lg border border-t-0 border-r-0 border-gray-500/20 bg-white shadow-xl dark:bg-black/40">
            <div className="p-3 text-center font-black uppercase opacity-50">
              Our Partners
            </div>
            {!partners.some((d) => d.libraries?.includes(libraryId as any)) ? (
              <div className="transition-colors hover:bg-gray-500/10 dark:hover:bg-gray-500/10">
                <a
                  href={`mailto:partners@tanstack.com?subject=TanStack ${
                    repo.split('/')[1]
                  } Partnership`}
                  className="block p-2 text-xs"
                >
                  <span className="italic opacity-50">
                    Wow, it looks like you could be our first partner for this
                    library!
                  </span>{' '}
                  <span className="font-black text-blue-500">
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
                      className="overflow-hidden transition-colors hover:bg-gray-500/10 dark:hover:bg-gray-500/10"
                    >
                      <a
                        href={partner.href}
                        target="_blank"
                        className="flex cursor-pointer flex-col items-center justify-center gap-1 px-4"
                        rel="noreferrer"
                      >
                        <div className="mx-auto max-w-[150px]">
                          <img
                            src={partner.sidebarImgLight}
                            alt={partner.name}
                            className={twMerge(
                              'w-full',
                              partner.sidebarImgClass,
                              'dark:hidden',
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
                              'hidden dark:block',
                            )}
                          />
                        </div>
                      </a>
                      {partner.sidebarAfterImg || null}
                    </div>
                  )
                })
            )}
          </div>
          {libraryId === 'query' ? (
            <div className="flex flex-col divide-y divide-gray-500/20 rounded-l-lg border-t border-b border-l border-gray-500/20 bg-white p-4 shadow-xl dark:bg-black/40">
              <DocsCalloutQueryGG />
            </div>
          ) : null}

          <div className="flex flex-col space-y-2 rounded-l-lg border-t border-b border-l border-gray-500/20 bg-white p-4 shadow-xl dark:bg-black/40">
            <GadRightRailSquare />
          </div>

          <div className="flex flex-col space-y-2 rounded-l-lg border-t border-b border-l border-gray-500/20 bg-white p-4 shadow-xl dark:bg-black/40">
            <GadLeftRailSquare />
          </div>

          {/* <div className="bg-white dark:bg-black/40 border-gray-500/20 shadow-xl flex flex-col border-t border-l border-b p-4 space-y-2 rounded-l-lg">
            <Carbon />
          </div> */}

          {libraryId !== 'query' ? (
            <div className="flex flex-col divide-y divide-gray-500/20 rounded-l-lg border-t border-b border-l border-gray-500/20 bg-white p-4 shadow-xl dark:bg-black/40">
              <DocsCalloutBytes />
            </div>
          ) : null}
        </div>
      </div>
      {showBytes ? (
        <div className="fixed top-1/2 right-2 z-30 w-[300px] max-w-[350px] -translate-y-1/2 shadow-lg md:hidden print:hidden">
          <div className="rounded-lg border border-black/10 bg-white p-4 md:p-6 dark:border-white/10 dark:bg-gray-800">
            {libraryId === 'query' ? (
              <DocsCalloutQueryGG />
            ) : (
              <DocsCalloutBytes />
            )}
            <button
              className="opacity:30 absolute top-0 right-0 p-2 hover:text-red-500 hover:opacity-100"
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
          className="fixed top-1/2 right-0 -translate-y-[50px] lg:hidden print:hidden"
          onClick={() => {
            setShowBytes(true)
          }}
        >
          <div className="origin-bottom-right -rotate-90 rounded-t-md border border-gray-100 bg-white p-1 px-2 text-xs shadow-md hover:bg-rose-600 hover:text-white dark:border-0 dark:bg-gray-800">
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
