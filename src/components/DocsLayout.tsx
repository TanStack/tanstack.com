import * as React from 'react'
import { X, TextAlignStart } from 'lucide-react'
import { FaArrowLeft, FaArrowRight, FaDiscord, FaGithub } from 'react-icons/fa'
import { Link, useMatches, useParams } from '@tanstack/react-router'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { last } from '~/utils/utils'
import type { ConfigSchema, MenuItem } from '~/utils/config'
import { Framework } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { twMerge } from 'tailwind-merge'
import { partners, PartnerImage } from '~/utils/partners'
import { GamFooter, GamVrec1 } from './Gam'
import { AdGate } from '~/contexts/AdsContext'
import { SearchButton } from './SearchButton'
import { FrameworkSelect, useCurrentFramework } from './FrameworkSelect'
import { VersionSelect } from './VersionSelect'

// Helper to get text color class from framework badge
const getFrameworkTextColor = (frameworkValue: string | undefined) => {
  if (!frameworkValue) return 'text-gray-500'
  const framework = frameworkOptions.find((f) => f.value === frameworkValue)

  return framework?.fontColor ?? 'text-gray-500'
}

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
      ...(config.sections.find((d) => d.label === 'Community Resources')
        ? [
            {
              label: 'Community Resources',
              to: '/$libraryId/$version/docs/community-resources',
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
  // const frameworkConfig = useFrameworkConfig({ frameworks })
  // const versionConfig = useVersionConfig({ versions })
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

  const [isFullWidth, setIsFullWidth] = useLocalStorage('docsFullWidth', false)

  const activePartners = partners.filter(
    (d) => d.status === 'active' && d.name !== 'Nozzle.io',
  )

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
        className="[&>summary]:before:mr-1 [&>summary]:marker:text-[0.8em] [&>summary]:marker:leading-4 relative select-none"
        {...detailsProps}
      >
        <LabelComp className="text-[.8em] uppercase font-black leading-4 ts-sidebar-label">
          {group?.label}
        </LabelComp>
        <div className="h-2" />
        <ul className="text-[.85em] leading-6 list-none">
          {group?.children?.map((child, i) => {
            const linkClasses = `flex gap-2 items-center justify-between group px-2 py-[.1rem] rounded-lg hover:bg-gray-500/10`

            return (
              <li key={i}>
                {child.to.startsWith('http') ? (
                  <a
                    href={child.to}
                    className={linkClasses}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {child.label}
                  </a>
                ) : (
                  <Link
                    from="/$libraryId/$version/docs"
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
                              } group-hover:opacity-100 font-bold transition-opacity ${getFrameworkTextColor(
                                child.badge,
                              )}`}
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

  const smallMenu = (
    <div
      className="lg:hidden bg-white/50 sticky top-[var(--navbar-height)]
    max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto z-20 dark:bg-black/60 backdrop-blur-lg"
    >
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500/20"
      >
        <summary className="py-2 px-4 flex gap-2 items-center justify-between">
          <div className="flex-1 flex gap-4 items-center">
            <TextAlignStart className="icon-open cursor-pointer" size={16} />
            <X className="icon-close cursor-pointer" size={16} />
            Documentation
          </div>
        </summary>
        <div className="flex flex-col gap-4 p-4 whitespace-nowrap overflow-y-auto border-t border-gray-500/20 bg-white/20 text-lg dark:bg-black/20">
          <div className="flex gap-4">
            <FrameworkSelect libraryId={libraryId} />
            <VersionSelect libraryId={libraryId} />
          </div>
          <SearchButton />
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div
      className="bg-white/50 dark:bg-black/30 shadow-xl max-w-[250px] xl:max-w-[300px] 2xl:max-w-[400px]
      hidden lg:flex flex-col gap-4 sticky
      h-[calc(100dvh-var(--navbar-height))] lg:top-[var(--navbar-height)]
      z-20 dark:border-r
      border-gray-500/20 transition-all duration-500 py-2"
    >
      <div className="flex gap-2 px-4">
        <FrameworkSelect libraryId={libraryId} />
        <VersionSelect libraryId={libraryId} />
      </div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base pb-8">
        {menuItems}
      </div>
    </div>
  )

  return (
    <WidthToggleContext.Provider value={{ isFullWidth, setIsFullWidth }}>
      <div
        className={`
          min-h-[calc(100dvh-var(--navbar-height))]
          flex flex-col lg:flex-row
          w-full transition-all duration-300`}
      >
        {smallMenu}
        {largeMenu}
        <div className="flex flex-col max-w-full min-w-0 w-full min-h-0 relative mb-8">
          <div
            className={twMerge(
              `max-w-full min-w-0 flex justify-center w-full min-h-[88dvh] lg:min-h-0`,
              !isExample && !isFullWidth && 'mx-auto w-[1208px]', // page width
            )}
          >
            {children}
          </div>
          <AdGate>
            <div className="px-2 xl:px-4">
              <div className="mb-8 !py-0! mx-auto max-w-full">
                <GamFooter popupPosition="top" />
              </div>
            </div>
          </AdGate>
          <div className="sticky flex items-center flex-wrap bottom-2 z-10 right-0 text-xs md:text-sm px-1 print:hidden">
            <div className="w-1/2 px-1 flex justify-end flex-wrap">
              {prevItem ? (
                <Link
                  from="/$libraryId/$version/docs"
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
                  from="/$libraryId/$version/docs"
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
        <div
          className="lg:-ml-2 lg:pl-2 w-full lg:w-[300px] shrink-0 lg:sticky
        lg:top-[var(--navbar-height)]
        "
        >
          <div className="lg:sticky lg:top-[var(--navbar-height)] ml-auto flex flex-wrap flex-row justify-center lg:flex-col gap-2">
            <div className="bg-white/70 dark:bg-black/40 border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border border-r-0 border-t-0 rounded-bl-lg">
              <div className="px-2 w-full flex gap-2 justify-between">
                <Link
                  className="uppercase font-black text-center pt-2 pb-1 opacity-60 hover:opacity-100 text-xs"
                  to="/partners"
                >
                  Partners
                </Link>
                <a
                  href="https://docs.google.com/document/d/1Hg2MzY2TU6U3hFEZ3MLe2oEOM3JS4-eByti3kdJU3I8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="uppercase font-black text-center pt-2 pb-1 opacity-60 hover:opacity-100 text-xs block hover:underline"
                >
                  Become a Partner
                </a>
              </div>
              <div
                className="flex flex-wrap justify-center px-4 py-2
                gap-x-3
                gap-y-3
                [@media(min-width:1600px)]:gap-y-4
                [@media(min-width:1920px)]:gap-y-6
              "
              >
                {activePartners
                  .filter((d) => d.id !== 'ui-dev')
                  .map((partner) => {
                    return (
                      <a
                        key={partner.name}
                        href={partner.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex grow-1 justify-center"
                      >
                        <div
                          className="z-0 flex items-center justify-center max-w-full"
                          style={{
                            width: Math.max(
                              50 + Math.round(200 * partner.score),
                              100,
                            ),
                          }}
                        >
                          <PartnerImage
                            config={partner.image}
                            alt={partner.name}
                          />
                        </div>
                      </a>
                    )
                  })}
              </div>
            </div>
            <AdGate>
              <GamVrec1 popupPosition="top" />
            </AdGate>
            {libraryId === 'query' ? (
              <div className="p-4 bg-white/70 dark:bg-black/40 border-b border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border-t border-l rounded-l-lg">
                <DocsCalloutQueryGG />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </WidthToggleContext.Provider>
  )
}
