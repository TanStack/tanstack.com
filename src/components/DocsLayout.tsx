import * as React from 'react'
import { TextAlignStart, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { DiscordIcon } from '~/components/icons/DiscordIcon'
import { Link, useMatches, useParams } from '@tanstack/react-router'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { useClickOutside } from '~/hooks/useClickOutside'
import { last } from '~/utils/utils'
import type { ConfigSchema, MenuItem } from '~/utils/config'
import { Framework } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { twMerge } from 'tailwind-merge'
import { partners, PartnerImage } from '~/utils/partners'
import { GamFooter, GamHeader, GamVrec1 } from './Gam'
import { AdGate } from '~/contexts/AdsContext'
import { SearchButton } from './SearchButton'
import { FrameworkSelect, useCurrentFramework } from './FrameworkSelect'
import { VersionSelect } from './VersionSelect'
import { Card } from './Card'

// Mobile partners strip - inline in the docs toggle bar
function MobilePartnersStrip({
  partners,
  onLabelClick,
}: {
  partners: Array<{
    name: string
    href: string
    image: Parameters<typeof PartnerImage>[0]['config']
  }>
  onLabelClick?: () => void
}) {
  const innerRef = React.useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = React.useState(false)
  const scrollPositionRef = React.useRef(0)
  const hasStartedRef = React.useRef(false)

  React.useEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    let animationId: number
    let timeoutId: ReturnType<typeof setTimeout>
    const scrollSpeed = 0.15 // pixels per frame
    const startDelay = 4000 // wait 4 seconds before starting (first time only)

    const animate = () => {
      if (!isHovered && inner) {
        scrollPositionRef.current += scrollSpeed
        // Reset when we've scrolled past the first set
        if (scrollPositionRef.current >= inner.scrollWidth / 2) {
          scrollPositionRef.current = 0
        }
        inner.style.transform = `translateX(${-scrollPositionRef.current}px)`
      }
      animationId = requestAnimationFrame(animate)
    }

    if (!hasStartedRef.current) {
      timeoutId = setTimeout(() => {
        hasStartedRef.current = true
        animationId = requestAnimationFrame(animate)
      }, startDelay)
    } else {
      animationId = requestAnimationFrame(animate)
    }

    return () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(animationId)
    }
  }, [isHovered])

  return (
    <div
      className="flex-1 flex items-center gap-2 min-w-0"
      onClick={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="text-[9px] uppercase tracking-wide font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onLabelClick?.()
        }}
      >
        Partners
      </button>
      <div
        className="relative flex-1 overflow-hidden min-w-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        <div className="overflow-hidden">
          <div
            ref={innerRef}
            className="flex items-center gap-4 w-max py-1 will-change-transform"
          >
            {/* Duplicate partners for seamless loop */}
            {[...partners, ...partners].map((partner, i) => (
              <a
                key={`${partner.name}-${i}`}
                href={partner.href}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 flex items-center opacity-50 hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-4 flex items-center [&_img]:h-full [&_img]:w-auto [&_div]:h-full">
                  <PartnerImage config={partner.image} alt={partner.name} />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component for the collapsed menu strip showing box indicators
// Minimap style: boxes with flex height filling available vertical space
function DocsMenuStrip({
  menuConfig,
  activeItem,
  fullPathname,
  colorFrom,
  colorTo,
  frameworkLogo,
  version,
  onHover,
  onClick,
}: {
  menuConfig: MenuItem[]
  activeItem: string | undefined
  fullPathname: string
  colorFrom: string
  colorTo: string
  frameworkLogo: string | undefined
  version: string
  onHover: () => void
  onClick: () => void
}) {
  // Flatten all menu items with section markers
  const itemsWithSections: Array<{
    to?: string
    label: React.ReactNode
    isSection: boolean
  }> = []
  menuConfig.forEach((group) => {
    itemsWithSections.push({ label: group.label, isSection: true })
    group.children?.forEach((child) => {
      itemsWithSections.push({
        to: child.to,
        label: child.label,
        isSection: false,
      })
    })
  })

  // Check if a menu item path matches the current location
  const isItemActive = (itemTo: string | undefined): boolean => {
    if (!itemTo) return false

    // External links are never active
    if (itemTo.startsWith('http')) return false

    // Standard relative path comparison
    if (itemTo === activeItem) return true

    // Handle special menu items with different path formats
    // ".." means we're on the library home page (no /docs suffix in pathname)
    if (itemTo === '..') {
      // Active when on the library version index (e.g., /query/latest but not /query/latest/docs/...)
      return fullPathname.match(/^\/[^/]+\/[^/]+\/?$/) !== null
    }

    // "./framework" means we're on the frameworks index page
    if (itemTo === './framework') {
      return (
        fullPathname.includes('/docs/framework') &&
        !fullPathname.match(/\/docs\/framework\/[^/]+/)
      )
    }

    // Handle absolute paths like "/$libraryId/$version/docs/contributors"
    if (itemTo.includes('/$libraryId')) {
      const pathSuffix = itemTo.split('/docs/')[1]
      if (pathSuffix && fullPathname.includes(`/docs/${pathSuffix}`)) {
        return true
      }
    }

    return false
  }

  return (
    <button
      type="button"
      className="flex flex-col gap-2 py-2 px-2 cursor-pointer h-full w-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-400/50"
      onPointerEnter={onHover}
      onFocus={onHover}
      onClick={onClick}
      aria-label="Open documentation menu"
    >
      {/* FrameworkSelect + VersionSelect icons */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-center">
          <span className="flex items-center justify-center w-6 h-6">
            {frameworkLogo ? (
              <img src={frameworkLogo} alt="" className="w-4 h-4" />
            ) : (
              <Menu className="w-3.5 h-3.5 opacity-60" />
            )}
          </span>
        </div>
        <div className="flex items-center justify-center">
          <span className="flex items-center justify-center px-1 py-0.5 text-[9px] font-medium opacity-60 border border-gray-500/30 rounded">
            {version}
          </span>
        </div>
      </div>

      {/* Minimap: flex-height boxes filling remaining space */}
      <div className="flex-1 flex flex-col gap-1 min-h-0">
        {itemsWithSections.map((item, index) => {
          const isActive = !item.isSection && isItemActive(item.to)

          return (
            <div
              key={index}
              className={twMerge(
                'flex-1 min-h-[4px] max-h-[9px] min-w-[20px] rounded-sm',
                item.isSection
                  ? 'w-full bg-current opacity-15'
                  : isActive
                    ? `ml-2 w-[calc(100%-0.5rem)] bg-linear-to-r ${colorFrom} ${colorTo}`
                    : 'ml-2 w-[calc(100%-0.5rem)] bg-current opacity-[0.06]',
              )}
              title={
                typeof item.label === 'string'
                  ? item.label
                  : `Item ${index + 1}`
              }
            />
          )
        })}
      </div>
    </button>
  )
}

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

// Create context for doc navigation (prev/next)
type DocNavItem = { label: React.ReactNode; to: string }
const DocNavigationContext = React.createContext<{
  prevItem?: DocNavItem
  nextItem?: DocNavItem
  colorFrom: string
  colorTo: string
  textColor: string
} | null>(null)

export const useDocNavigation = () => {
  return React.useContext(DocNavigationContext)
}

export function DocNavigation() {
  const context = useDocNavigation()
  if (!context) return null

  const { prevItem, nextItem, colorFrom, colorTo, textColor } = context

  if (!prevItem && !nextItem) return null

  return (
    <div className="sticky flex items-stretch bottom-2 z-10 right-0 text-[10px] sm:text-xs md:text-sm print:hidden">
      <div className="flex-1 flex justify-start">
        {prevItem ? (
          <Card
            as={Link}
            from="/$libraryId/$version/docs"
            to={prevItem.to}
            params
            className="py-1 px-2 sm:py-2 sm:px-3 flex items-center gap-1 sm:gap-2"
          >
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            <div className="flex flex-col">
              <span className="hidden sm:block text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                Previous
              </span>
              <span className="font-bold">{prevItem.label}</span>
            </div>
          </Card>
        ) : null}
      </div>
      <div className="flex-1 flex justify-end">
        {nextItem ? (
          <Card
            as={Link}
            from="/$libraryId/$version/docs"
            to={nextItem.to}
            params
            className="py-1 px-2 sm:py-2 sm:px-3 flex items-center gap-1 sm:gap-2"
          >
            <div className="flex flex-col items-end">
              <span className="hidden sm:block text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                Next
              </span>
              <span
                className={`font-bold text-right bg-linear-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent`}
              >
                {nextItem.label}
              </span>
            </div>
            <ChevronRight
              className={twMerge('w-3 h-3 sm:w-4 sm:h-4', textColor)}
            />
          </Card>
        ) : null}
      </div>
    </div>
  )
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
            GitHub <GithubIcon className="opacity-20" />
          </div>
        ),
        to: `https://github.com/${repo}`,
      },
      {
        label: (
          <div className="flex items-center gap-2">
            Discord <DiscordIcon className="text-lg opacity-20" />
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
  colorFrom,
  colorTo,
  textColor,
  config,
  frameworks,
  repo,
  children,
}: DocsLayoutProps) {
  const { libraryId, version } = useParams({
    from: '/$libraryId/$version/docs',
  })
  const { _splat } = useParams({ strict: false })
  const menuConfig = useMenuConfig({ config, frameworks, repo })

  const matches = useMatches()
  const lastMatch = last(matches)

  const isExample = matches.some((d) => d.pathname.includes('/examples/'))

  const detailsRef = React.useRef<HTMLElement>(null!)

  const flatMenu = React.useMemo(
    () => menuConfig.flatMap((d) => d?.children),
    [menuConfig],
  )

  // Filter out external links for prev/next navigation
  const internalFlatMenu = React.useMemo(
    () => flatMenu.filter((d) => d && !d.to.startsWith('http')),
    [flatMenu],
  )

  const docsMatch = matches.find((d) => d.pathname.includes('/docs'))
  const docsPathname = docsMatch?.pathname ?? ''

  const relativePathname = lastMatch.pathname.replace(docsPathname + '/', '')

  const index = internalFlatMenu.findIndex((d) => d?.to === relativePathname)
  const prevItem = internalFlatMenu[index - 1]
  const nextItem = internalFlatMenu[index + 1]

  // Get current framework's logo for the preview strip
  const currentFramework = useCurrentFramework(frameworks)
  const currentFrameworkOption = frameworkOptions.find(
    (f) => f.value === currentFramework.framework,
  )

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
        <LabelComp className="text-[.8em] font-bold leading-4 px-2 ts-sidebar-label">
          {group?.label}
        </LabelComp>
        <div className="h-2" />
        <ul className="text-[.85em] leading-snug list-none">
          {group?.children?.map((child, i) => {
            const linkClasses = `flex gap-2 items-center justify-between group px-2 py-1.5 rounded-lg hover:bg-gray-500/10 opacity-60 hover:opacity-100`

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
                        <div
                          className={twMerge(
                            linkClasses,
                            props.isActive && 'opacity-100',
                          )}
                        >
                          <div
                            className={twMerge(
                              'w-full',
                              props.isActive
                                ? `font-bold text-transparent bg-clip-text bg-linear-to-r ${colorFrom} ${colorTo}`
                                : '',
                            )}
                          >
                            {child.label}
                          </div>
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
      className="sm:hidden bg-white/50 sticky top-[var(--navbar-height)]
    max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto z-20 dark:bg-black/60 backdrop-blur-lg"
    >
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500/20"
      >
        <summary className="py-2 px-4 flex gap-2 items-center">
          <div className="flex gap-2 items-center shrink-0 pr-2">
            <Menu className="cursor-pointer" />
            Docs
          </div>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 shrink-0" />
          <MobilePartnersStrip
            partners={activePartners}
            onLabelClick={() => {
              const details = detailsRef.current as HTMLDetailsElement | null
              if (details) {
                details.open = !details.open
              }
            }}
          />
        </summary>
        <div className="flex flex-col gap-4 p-4 overflow-y-auto border-t border-gray-500/20 bg-white/20 text-lg dark:bg-black/20">
          <div className="flex flex-col gap-1">
            <FrameworkSelect libraryId={libraryId} />
            <VersionSelect libraryId={libraryId} />
          </div>
          <SearchButton />
          {menuItems}
        </div>
      </details>
    </div>
  )

  // State and timer for auto-hide behavior (similar to Navbar)
  const [showLargeMenu, setShowLargeMenu] = React.useState(false)
  const leaveTimer = React.useRef<NodeJS.Timeout | undefined>(undefined)

  // Close menu when clicking outside (only on sm-xl screens where it's an overlay)
  const expandedMenuRef = useClickOutside<HTMLDivElement>({
    enabled:
      showLargeMenu &&
      typeof window !== 'undefined' &&
      window.innerWidth < 1280,
    onClickOutside: () => setShowLargeMenu(false),
  })

  const largeMenu = (
    <>
      {/* Collapsed strip - visible on sm to xl, hidden on xl+. Lower z-index so expanded menu covers it */}
      <div
        className={twMerge(
          'hidden sm:flex xl:hidden flex-col overflow-hidden',
          'sticky top-[var(--navbar-height)] h-[calc(100dvh-var(--navbar-height))]',
          'z-10 border-r border-gray-500/20',
          'bg-white/50 dark:bg-black/30',
          'w-10',
        )}
      >
        <DocsMenuStrip
          menuConfig={menuConfig}
          activeItem={relativePathname}
          fullPathname={lastMatch.pathname}
          colorFrom={colorFrom}
          colorTo={colorTo}
          frameworkLogo={currentFrameworkOption?.logo}
          version={version}
          onHover={() => {
            if (window.innerWidth < 1280) {
              // Only auto-show on lg screens, not xl+
              clearTimeout(leaveTimer.current)
              setShowLargeMenu(true)
            }
          }}
          onClick={() => {
            if (window.innerWidth < 1280) {
              clearTimeout(leaveTimer.current)
              setShowLargeMenu(true)
            }
          }}
        />
      </div>

      {/* Expanded menu - always visible on xl+, toggleable overlay on sm-xl */}
      <div
        ref={expandedMenuRef}
        className={twMerge(
          'max-w-[250px] xl:max-w-[300px] 2xl:max-w-[400px]',
          'flex-col overflow-hidden',
          'h-[calc(100dvh-var(--navbar-height))] top-[var(--navbar-height)]',
          'z-20 border-r border-gray-500/20',
          'transition-all duration-300',
          // Hidden on smallest screens, flex on sm+
          'hidden sm:flex',
          // On sm to xl: fixed overlay that slides in from left-0 (covers the strip)
          'sm:fixed sm:left-0 sm:bg-white sm:dark:bg-black/95 sm:backdrop-blur-lg sm:shadow-xl',
          // On xl+: sticky positioning, no overlay styling
          'xl:sticky xl:bg-transparent xl:dark:bg-transparent xl:backdrop-blur-none xl:shadow-none',
          // Slide animation for sm-xl screens (off-screen by default, slides in when shown)
          // On xl+: always visible (no translate)
          !showLargeMenu && 'sm:-translate-x-full xl:translate-x-0',
          showLargeMenu && 'sm:translate-x-0',
        )}
        onPointerEnter={(e) => {
          if (e.pointerType === 'touch') return
          if (window.innerWidth < 1280) {
            clearTimeout(leaveTimer.current)
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'touch') return
          if (window.innerWidth < 1280) {
            leaveTimer.current = setTimeout(() => {
              setShowLargeMenu(false)
            }, 300)
          }
        }}
      >
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex flex-col gap-1 p-4">
            <FrameworkSelect libraryId={libraryId} />
            <VersionSelect libraryId={libraryId} />
          </div>
          <div className="flex-1 flex flex-col gap-4 text-base px-4 pt-0 pb-4">
            {menuItems}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <WidthToggleContext.Provider value={{ isFullWidth, setIsFullWidth }}>
      <DocNavigationContext.Provider
        value={{ prevItem, nextItem, colorFrom, colorTo, textColor }}
      >
        <div
          className={`
          min-h-[calc(100dvh-var(--navbar-height))]
          flex flex-col sm:flex-row
          w-full transition-all duration-300
          [overflow-x:clip]`}
        >
          {smallMenu}
          {largeMenu}
          <div className="flex flex-col max-w-full min-w-0 flex-1 min-h-0 relative px-4 sm:px-8">
            <div
              className={twMerge(
                `max-w-full min-w-0 flex flex-col justify-center w-full min-h-[88dvh] sm:min-h-0`,
                !isExample && !isFullWidth && 'mx-auto w-[900px]', // page width
              )}
            >
              {children}
            </div>
            <AdGate>
              {/* <div className="flex border-t border-gray-500/20">
              <div className="py-4 px-2 xl:px-4 mx-auto max-w-full justify-center">
                <GamFooter popupPosition="top" />
              </div>
            </div> */}
              <div className="py-8 lg:py-12 xl:py-16 max-w-full">
                <GamHeader />
              </div>
            </AdGate>
          </div>
          <div
            className="w-full sm:w-[300px] shrink-0 sm:sticky
        sm:top-[var(--navbar-height)]
        "
          >
            <div className="sm:sticky sm:top-[var(--navbar-height)] ml-auto flex flex-wrap flex-row justify-center sm:flex-col gap-4 pb-4 max-w-full overflow-hidden">
              <div className="flex flex-wrap items-stretch border-l border-gray-500/20 rounded-bl-lg overflow-hidden w-full">
                <div className="w-full flex gap-2 justify-between border-b border-gray-500/20 px-3 py-2">
                  <Link
                    className="font-medium opacity-60 hover:opacity-100 text-xs"
                    to="/partners"
                  >
                    Partners
                  </Link>
                  <a
                    href="https://docs.google.com/document/d/1Hg2MzY2TU6U3hFEZ3MLe2oEOM3JS4-eByti3kdJU3I8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium opacity-60 hover:opacity-100 text-xs hover:underline"
                  >
                    Become a Partner
                  </a>
                </div>
                {activePartners
                  .filter((d) => d.id !== 'ui-dev')
                  .map((partner) => {
                    // flexBasis as percentage based on score, flexGrow to fill remaining row space
                    const widthPercent = Math.round(partner.score * 100)

                    return (
                      <a
                        key={partner.name}
                        href={partner.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center px-3 py-2
                          border-r border-b border-gray-500/20
                          hover:bg-gray-500/10 transition-colors duration-150 ease-out"
                        style={{
                          flexBasis: `${widthPercent}%`,
                          flexGrow: 1,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: Math.max(
                              60 + Math.round(140 * partner.score),
                              70,
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
              <AdGate>
                <GamVrec1
                  popupPosition="top"
                  borderClassName="rounded-l-xl rounded-r-none"
                />
              </AdGate>
              {libraryId === 'query' ? (
                <div className="p-4 bg-white/70 dark:bg-black/40 rounded-lg flex flex-col">
                  <DocsCalloutQueryGG />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DocNavigationContext.Provider>
    </WidthToggleContext.Provider>
  )
}
