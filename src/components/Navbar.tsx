import * as React from 'react'
import { twMerge } from 'tailwind-merge'
const LazyAiDock = React.lazy(() =>
  import('./SearchModal').then((m) => ({ default: m.AiDock })),
)
const LazyNavbarAuthControls = React.lazy(() =>
  import('./NavbarAuthControls').then((m) => ({
    default: m.NavbarAuthControls,
  })),
)
import { NavbarCartButton } from './NavbarCartButton'
import { MegaMenuItem } from './MegaMenuItem'
import { Link, useLocation, useMatches } from '@tanstack/react-router'
import {
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  Code,
  GridFour,
  Hammer,
  Heart,
  Question as HelpCircle,
  Envelope as Mail,
  List as Menu,
  PaintBrush as Paintbrush,
  ShieldCheck,
  ShoppingBag,
  Sparkle as Sparkles,
  TrendUp as TrendingUp,
  User,
  Users,
  X,
} from '@phosphor-icons/react'
import { ThemeToggle } from './ThemeToggle'
import { AiDockButton, SearchButton } from './SearchButton'
import { BrandContextMenu } from './BrandContextMenu'
import { useSearchContext } from '~/contexts/SearchContext'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { findLibrary, publicLibraries, type LibrarySlim } from '~/libraries'
import {
  categoryLabels,
  categoryOrder,
  categoryTextColor,
  libraryCategories,
  type LibraryCategory,
} from '~/libraries/categories'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'
import { GithubIcon } from '~/components/icons/GithubIcon'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/Dropdown'
import { DiscordIcon } from '~/components/icons/DiscordIcon'
import { InstagramIcon } from '~/components/icons/InstagramIcon'
import { OptimizedImage } from '~/components/OptimizedImage'
import { BSkyIcon } from '~/components/icons/BSkyIcon'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import { getProducts } from '~/utils/shop.functions'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import type { ProductListItem } from '~/utils/shopify-queries'
import type { PartnerPlacement } from '~/utils/analytics'
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'
import { fetchRecentPosts, type RecentPost } from '~/utils/blog.functions'
import { formatAuthors, formatPublishedDate } from '~/utils/blog-format'
import { getOptimizedImageUrl } from '~/utils/optimizedImage'
import { CoverFallback } from '~/components/CoverFallback'

type LogoProps = {
  title?: React.ComponentType | null
}

const LogoSection = ({ title }: LogoProps) => {
  return (
    <Link
      to="/"
      className={twMerge(
        `inline-flex items-center gap-1.5 cursor-pointer`,
        title ? 'shrink-0' : '',
      )}
    >
      <div className="w-[30px] inline-grid items-center grid-cols-1 grid-rows-1 [&>*]:transition-opacity [&>*]:duration-1000">
        <OptimizedImage
          src="/images/logos/logo-color-100.png"
          alt=""
          width={30}
          quality={90}
          className="row-start-1 col-start-1 w-full group-hover:opacity-0"
        />
        <img
          src={'/images/logos/logo-black.svg'}
          alt=""
          className="row-start-1 col-start-1 w-full dark:opacity-0 opacity-0 group-hover:opacity-100"
        />
        <img
          src={'/images/logos/logo-white.svg'}
          alt=""
          className="row-start-1 col-start-1 w-full light:opacity-0 dark:block opacity-0 group-hover:opacity-100"
        />
      </div>
      <div>TanStack</div>
    </Link>
  )
}

type IconComponent = React.ComponentType<{ className?: string }>

type NavMenuKey =
  | 'libraries'
  | 'learn'
  | 'community'
  | 'tools'
  | 'merch'
  | 'support'

type NavMenuItem = {
  analyticsPlacement?: PartnerPlacement
  label: string
  to: string
  hash?: string
  description?: string
  badge?: string
  icon?: IconComponent
  // When set, the item renders as a button that runs this instead of navigating.
  onSelect?: () => void
}

type NavMenuSection = {
  label: string
  items: readonly NavMenuItem[]
}

type NavMenuGroup = {
  key: NavMenuKey
  label: string
  to?: string
  sections: readonly NavMenuSection[]
  rail?: {
    eyebrow: string
    title: string
    description: string
    item: NavMenuItem
  }
}

const MERCH_MENU_PRODUCT_COUNT = 3

const DESKTOP_NAV_CLASS = 'hidden min-[900px]:flex'
const MOBILE_NAV_CLASS = 'min-[900px]:hidden'
const DESKTOP_SOCIAL_CLASS = 'hidden min-[1120px]:flex'

const NAV_GROUPS = [
  {
    key: 'libraries',
    label: 'Libraries',
    to: '/libraries',
    sections: [],
  },
  {
    key: 'learn',
    label: 'Blog',
    to: '/blog',
    sections: [
      {
        label: 'About',
        items: [
          {
            label: 'YouTube',
            to: 'https://youtube.com/@tan_stack',
            description: 'The official TanStack channel.',
            icon: YouTubeIcon,
          },
          {
            label: 'Workshops',
            to: '/workshops',
            description: 'Remote and in-person sessions from maintainers.',
            icon: Users,
          },
          {
            label: 'Release Notes',
            to: '/blog',
            description: 'The latest releases and changelog.',
            icon: Sparkle,
          },
        ],
      },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    sections: [
      {
        label: 'Channels',
        items: [
          {
            label: 'Discord',
            to: 'https://tlinz.com/discord',
            description: 'Community support and real-time discussion.',
            icon: DiscordIcon,
          },
          {
            label: 'GitHub',
            to: 'https://github.com/TanStack',
            description: 'Source, issues, discussions, and releases.',
            icon: GithubIcon,
          },
        ],
      },
      {
        label: 'People & Work',
        items: [
          {
            label: 'Maintainers',
            to: '/maintainers',
            description: 'Meet the people maintaining the stack.',
            icon: Code,
          },
          {
            label: 'Contributors',
            to: '/maintainers',
            description: 'Core, library, and community contributors.',
            icon: Users,
          },
          {
            label: 'Showcase',
            to: '/showcase',
            description: 'Products and teams building with TanStack.',
            icon: Sparkles,
          },
        ],
      },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    sections: [
      {
        label: 'Tools',
        items: [
          {
            label: 'Builder',
            to: '/builder',
            description: 'Generate TanStack app starters.',
            badge: 'Alpha',
            icon: Hammer,
          },
          {
            label: 'Stats',
            to: '/stats/npm',
            description: 'NPM and ecosystem usage data.',
            icon: TrendingUp,
          },
        ],
      },
    ],
  },
  {
    key: 'merch',
    label: 'Merch',
    to: '/shop',
    sections: [],
  },
  {
    key: 'support',
    label: 'Support',
    sections: [
      {
        label: 'Support',
        items: [
          {
            label: 'Support Overview',
            to: '/support',
            description: 'Find the right support path.',
            icon: HelpCircle,
          },
          {
            label: 'Partners',
            to: '/partners',
            description: 'Companies supporting TanStack.',
            icon: Heart,
          },
          {
            label: 'OSS Sponsors',
            to: '/',
            hash: 'sponsors',
            description: 'Sponsors keeping TanStack open source.',
            icon: ShieldCheck,
          },
          {
            label: 'Enterprise Support',
            to: '/paid-support',
            description: 'Private consulting and expert support.',
            icon: Users,
          },
          {
            label: 'Contact',
            to: 'mailto:support@tanstack.com',
            description: 'Get in touch with the TanStack team.',
            icon: Mail,
          },
        ],
      },
      {
        label: 'About',
        items: [
          {
            label: 'Ethos',
            to: '/ethos',
            description: 'How we think about open source and products.',
            icon: ShieldCheck,
          },
          {
            label: 'Tenets',
            to: '/tenets',
            description: 'The values that shape TanStack libraries.',
            icon: BookOpen,
          },
          {
            label: 'Brand Guide',
            to: '/brand-guide',
            description: 'Logos, colors, and brand usage.',
            icon: Paintbrush,
          },
          {
            label: 'Design System',
            to: '/ds',
            description: 'Design tokens and components for TanStack surfaces.',
            icon: GridFour,
          },
        ],
      },
    ],
    rail: {
      eyebrow: 'Partners',
      title: 'Work with TanStack',
      description: 'Sponsorships, placements, and partner pages.',
      item: {
        analyticsPlacement: 'navbar',
        label: 'Partnership Inquiry',
        to: PARTNER_INQUIRY_HREF,
        icon: Mail,
      },
    },
  },
] as const satisfies readonly NavMenuGroup[]

function getLibraryDisplayName(library: LibrarySlim) {
  return library.name.replace(/^TanStack\s+/, '')
}

type LibraryMenuEntry = {
  id: string
  name: string
  to: string
  icon: IconComponent
  /** `group-hover/lib:text-category-*` — recolors the icon to its category. */
  iconHoverColor: string
}

// Full static class strings (Tailwind can't see composed names) mapping each
// category to the hover color applied to a library's icon in the mega-menu.
const categoryIconHoverColor: Record<LibraryCategory, string> = {
  framework: 'group-hover/lib:text-category-framework',
  data: 'group-hover/lib:text-category-data',
  ui: 'group-hover/lib:text-category-ui',
  performance: 'group-hover/lib:text-category-performance',
  tooling: 'group-hover/lib:text-category-tooling',
}

type LibraryMenuColumn = {
  category: LibraryCategory
  label: string
  colorClass: string
  libraries: LibraryMenuEntry[]
}

/**
 * The Libraries mega-menu as five category columns (Framework, Data & State,
 * UI & UX, Performance, Tooling), built from the canonical `libraryCategories`
 * taxonomy. Iterating `libraryCategories` preserves the intended per-category
 * order; only public, navigable libraries are shown.
 */
// Public libraries intentionally omitted from the Libraries mega-menu (still
// reachable via the full-screen "Browse all libraries" overlay).
const LIBRARY_MENU_EXCLUDED_IDS = new Set(['ranger'])

function getLibraryCategoryColumns(): LibraryMenuColumn[] {
  const byCategory = new Map<LibraryCategory, LibraryMenuEntry[]>(
    categoryOrder.map((category) => [category, []]),
  )

  for (const [id, category] of Object.entries(libraryCategories)) {
    if (LIBRARY_MENU_EXCLUDED_IDS.has(id)) continue
    const library = publicLibraries.find((lib) => lib.id === id)
    if (!library || !library.to) continue
    byCategory.get(category)?.push({
      id: library.id,
      name: getLibraryDisplayName(library),
      to: library.to,
      icon: libraryIcons[library.id] ?? fallbackLibraryIcon,
      iconHoverColor: categoryIconHoverColor[category],
    })
  }

  return categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category],
      colorClass: categoryTextColor[category],
      libraries: byCategory.get(category) ?? [],
    }))
    .filter((column) => column.libraries.length > 0)
}

function AiDockMount() {
  const { isAiDockOpen } = useSearchContext()
  const [hasActivated, setHasActivated] = React.useState(isAiDockOpen)

  React.useEffect(() => {
    if (isAiDockOpen) {
      setHasActivated(true)
    }
  }, [isAiDockOpen])

  if (!hasActivated && !isAiDockOpen) {
    return null
  }

  return (
    <React.Suspense fallback={null}>
      <LazyAiDock />
    </React.Suspense>
  )
}

export function Navbar({ children }: { children: React.ReactNode }) {
  const matches = useMatches()
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const isLibraryLanding =
    pathSegments.length === 2 && Boolean(findLibrary(pathSegments[0]))

  const { Title } = React.useMemo(() => {
    const match = [...matches].reverse().find((m) => m.staticData.Title)

    return {
      Title: match?.staticData.Title ?? null,
    }
  }, [matches])

  const containerRef = React.useRef<HTMLDivElement>(null)
  const desktopNavRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const desktopNav = desktopNavRef.current

    if (!desktopNav) {
      return
    }

    const updateDesktopNavWidth = () => {
      const targetWidth = Math.ceil(
        desktopNav.getBoundingClientRect().width + 32,
      )

      desktopNav.style.setProperty(
        '--ts-primary-nav-target-width',
        `${targetWidth}px`,
      )
    }

    let animationFrameId: number | null = null
    const scheduleDesktopNavWidthUpdate = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        updateDesktopNavWidth()
      })
    }

    updateDesktopNavWidth()

    const resizeObserver =
      typeof window.ResizeObserver === 'function'
        ? new window.ResizeObserver(scheduleDesktopNavWidthUpdate)
        : null

    resizeObserver?.observe(desktopNav)
    window.addEventListener('resize', scheduleDesktopNavWidthUpdate)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleDesktopNavWidthUpdate)
    }
  }, [])

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [dismissedDesktopMenuKey, setDismissedDesktopMenuKey] =
    React.useState<NavMenuKey | null>(null)
  const [canLoadAuthControls, setCanLoadAuthControls] = React.useState(false)

  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.href])

  const blurActiveNavigationElement = React.useCallback(() => {
    if (typeof document === 'undefined') {
      return
    }

    const activeElement = document.activeElement

    if (
      activeElement instanceof HTMLElement &&
      containerRef.current?.contains(activeElement)
    ) {
      activeElement.blur()
    }
  }, [])

  const dismissDesktopMenu = React.useCallback(
    (key: NavMenuKey) => {
      setDismissedDesktopMenuKey(key)
      blurActiveNavigationElement()
    },
    [blurActiveNavigationElement],
  )

  const requestAuthControls = React.useCallback(() => {
    setCanLoadAuthControls(true)
  }, [])

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen])

  const getLoginButtonFallback = (className?: string) => (
    <Link
      to="/login"
      aria-label="Log In"
      className={twMerge(
        'flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 whitespace-nowrap',
        'bg-black dark:bg-white text-white dark:text-black',
        'hover:bg-gray-800 dark:hover:bg-gray-200',
        'transition-colors duration-200 text-xs font-medium',
        className,
      )}
    >
      <User className="w-3.5 h-3.5" />
      <span className="hidden min-[430px]:inline">Log In</span>
    </Link>
  )
  const renderAuthControls = (className?: string) =>
    canLoadAuthControls ? (
      <React.Suspense fallback={getLoginButtonFallback(className)}>
        <LazyNavbarAuthControls className={className} />
      </React.Suspense>
    ) : (
      getLoginButtonFallback(className)
    )

  const socialLinks = <SocialStack />
  const siteBackdropActive = mobileMenuOpen

  const navbar = (
    <div
      className={twMerge(
        'w-full h-[var(--navbar-height)] px-3 py-2 min-[900px]:px-5 fixed top-0 z-[100] bg-white/90 dark:bg-black/90 backdrop-blur-lg',
        'flex items-center justify-between gap-2 min-[1120px]:gap-4',
        'border-b border-gray-500/20',
      )}
      ref={containerRef}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 min-[1120px]:gap-3">
        <div className="flex items-center gap-2 font-black text-xl uppercase min-w-0">
          <BrandContextMenu
            className={twMerge(`flex items-center group shrink-0`)}
          >
            <LogoSection title={isLibraryLanding ? null : Title} />
          </BrandContextMenu>
          {Title && !isLibraryLanding ? (
            <div className="truncate">
              <Title />
            </div>
          ) : null}
        </div>

        <nav
          ref={desktopNavRef}
          aria-label="Primary navigation"
          className={twMerge(
            DESKTOP_NAV_CLASS,
            'relative shrink-0 items-center gap-0',
          )}
        >
          {NAV_GROUPS.map((group) => (
            <DesktopNavTrigger
              key={group.key}
              group={group}
              dismissed={dismissedDesktopMenuKey === group.key}
              onDismiss={() => dismissDesktopMenu(group.key)}
              onResetDismissed={() => {
                setDismissedDesktopMenuKey((dismissedKey) =>
                  dismissedKey === group.key ? null : dismissedKey,
                )
              }}
            />
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className={DESKTOP_SOCIAL_CLASS}>{socialLinks}</div>
        <ThemeToggle />
        <NavbarCartButton />
        <SearchButton iconOnly />
        <AiDockButton />
        <div
          className={twMerge(DESKTOP_NAV_CLASS, 'items-center gap-2')}
          onFocusCapture={requestAuthControls}
          onPointerEnter={requestAuthControls}
          onTouchStart={requestAuthControls}
        >
          {renderAuthControls()}
        </div>
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-mobile-menu"
          className={twMerge(
            'inline-flex h-9 w-9 items-center justify-center rounded-md',
            'text-gray-700 transition-colors hover:bg-gray-500/10',
            'dark:text-gray-200',
            MOBILE_NAV_CLASS,
          )}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  )

  const mobileMenu = (
    <Collapsible
      open={mobileMenuOpen}
      onOpenChange={setMobileMenuOpen}
      className={MOBILE_NAV_CLASS}
    >
      <CollapsibleContent
        className={twMerge(
          'fixed left-0 right-0 top-[var(--navbar-height)] z-[90]',
          'motion-reduce:transition-none',
          mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          id="primary-mobile-menu"
          data-mobile-menu
          aria-hidden={!mobileMenuOpen}
          className={twMerge(
            'ts-glass-menu max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto',
            'border-b border-white/45 bg-white/80 text-base shadow-2xl shadow-black/15 backdrop-blur-2xl backdrop-saturate-150',
            'dark:border-white/10 dark:bg-black/70 dark:shadow-black/50',
          )}
        >
          <div className="border-t border-white/30 dark:border-white/10">
            <div
              className="flex items-center justify-end gap-2 p-2"
              onFocusCapture={requestAuthControls}
              onPointerEnter={requestAuthControls}
              onTouchStart={requestAuthControls}
            >
              {socialLinks}
              {renderAuthControls('h-9 px-3 text-sm')}
            </div>
            <nav
              className="grid gap-1.5 px-2 pb-2"
              aria-label="Mobile navigation"
            >
              {NAV_GROUPS.map((group) => (
                <MobileMenuGroup
                  key={group.key}
                  group={group}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )

  return (
    <>
      {navbar}
      {mobileMenu}
      <div
        aria-hidden="true"
        data-site-menu-tint
        className={twMerge(
          'pointer-events-none fixed inset-x-0 bottom-0 top-[var(--navbar-height)] z-[80]',
          'bg-white/45 transition-opacity duration-200 motion-reduce:transition-none dark:bg-black/45',
          siteBackdropActive ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        data-site-content
        className={twMerge(
          `min-h-[calc(100dvh-var(--navbar-height))] flex flex-col
          min-w-0 w-full transition-[filter] duration-200 motion-reduce:transition-none
          pt-[var(--navbar-height)]`,
          siteBackdropActive ? 'blur-[4px]' : 'filter-none',
        )}
      >
        <div className="flex-1 min-w-0 flex flex-col w-full min-h-0">
          {children}
        </div>
      </div>
      <AiDockMount />
    </>
  )
}

function DesktopNavTrigger({
  group,
  dismissed,
  onDismiss,
  onResetDismissed,
}: {
  group: NavMenuGroup
  dismissed: boolean
  onDismiss: () => void
  onResetDismissed: () => void
}) {
  const { openLibraries } = useLibrariesOverlay()
  const triggerClassName = twMerge(
    'ts-mega-trigger inline-flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium min-[1120px]:gap-1.5 min-[1120px]:px-3 min-[1120px]:text-[13px]',
    'text-gray-700 transition-colors hover:bg-gray-500/10 hover:text-gray-950',
    'dark:text-gray-300 dark:hover:text-white',
  )

  return (
    <div
      className="ts-mega-trigger-wrap"
      data-menu-key={group.key}
      data-menu-dismissed={dismissed ? 'true' : undefined}
      onPointerLeave={onResetDismissed}
      onFocusCapture={onResetDismissed}
    >
      {group.key === 'libraries' ? (
        <button
          type="button"
          data-menu-key={group.key}
          className={triggerClassName}
          onClick={() => {
            openLibraries()
            onDismiss()
          }}
        >
          <span>{group.label}</span>
        </button>
      ) : group.to ? (
        <Link
          to={group.to}
          data-menu-key={group.key}
          className={triggerClassName}
          onClick={onDismiss}
          preload="intent"
        >
          <span>{group.label}</span>
        </Link>
      ) : (
        <button
          type="button"
          data-menu-key={group.key}
          className={triggerClassName}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
        >
          <span>{group.label}</span>
        </button>
      )}
      <DesktopNavDropdown group={group} onNavigate={onDismiss} />
    </div>
  )
}

function DesktopNavDropdown({
  group,
  onNavigate,
}: {
  group: NavMenuGroup
  onNavigate: () => void
}) {
  return (
    <div className="ts-mega-dropdown">
      <div
        className={twMerge(
          'ts-mega-dropdown-panel ts-glass-menu rounded-xl',
          'w-max min-w-[var(--ts-primary-nav-target-width,0px)] max-w-[calc(100vw-2rem)]',
          'border border-white/45 bg-white/80 pt-10 px-9 pb-8 shadow-2xl shadow-black/15 backdrop-blur-2xl backdrop-saturate-150',
          'dark:border-white/10 dark:bg-black/70 dark:shadow-black/50',
        )}
      >
        <MegaMenuContent
          group={group}
          onNavigate={onNavigate}
          variant="desktop"
        />
      </div>
    </div>
  )
}

function MobileMenuGroup({
  group,
  onNavigate,
}: {
  group: NavMenuGroup
  onNavigate: () => void
}) {
  const { openLibraries } = useLibrariesOverlay()

  // Libraries defers to the full-screen browse overlay rather than expanding a
  // tall inline list — one tap opens the same browser the desktop trigger uses.
  if (group.key === 'libraries') {
    return (
      <button
        type="button"
        onClick={() => {
          openLibraries()
          onNavigate()
        }}
        className={twMerge(
          'flex w-full items-center gap-2 rounded-lg border border-gray-500/10 bg-white/35 px-3 py-3 text-left font-black text-gray-800',
          'hover:text-gray-950 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:text-white',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <ArrowRight className="size-4 shrink-0 text-gray-500 dark:text-gray-400" />
      </button>
    )
  }

  return (
    <Collapsible className="overflow-hidden rounded-lg border border-gray-500/10 bg-white/35 dark:border-white/10 dark:bg-white/[0.03]">
      {({ open }) => (
        <>
          {group.to ? (
            <div className="flex items-center">
              <CollapsibleTrigger
                aria-label={`${open ? 'Collapse' : 'Expand'} ${group.label}`}
                className={twMerge(
                  'flex min-w-0 flex-1 items-center px-3 py-3 text-left font-black text-gray-800',
                  'hover:text-gray-950 focus:outline-none dark:text-gray-200 dark:hover:text-white',
                  open && 'text-gray-950 dark:text-white',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
              </CollapsibleTrigger>
            </div>
          ) : (
            <CollapsibleTrigger
              className={twMerge(
                'flex w-full items-center px-3 py-3 text-left font-black text-gray-800',
                'hover:text-gray-950 dark:text-gray-200 dark:hover:text-white',
                open && 'text-gray-950 dark:text-white',
              )}
            >
              {group.label}
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className="border-t border-gray-500/10 motion-reduce:transition-none dark:border-white/10">
            <div className="px-2 pb-3 pt-1">
              <MegaMenuContent
                group={group}
                onNavigate={onNavigate}
                variant="mobile"
              />
            </div>
          </CollapsibleContent>
        </>
      )}
    </Collapsible>
  )
}

function MegaMenuContent({
  group,
  onNavigate,
  variant,
}: {
  group: NavMenuGroup
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  if (group.key === 'libraries') {
    return <LibrariesMenuContent onNavigate={onNavigate} variant={variant} />
  }

  if (group.key === 'learn') {
    return (
      <BlogMenuContent
        group={group}
        onNavigate={onNavigate}
        variant={variant}
      />
    )
  }

  if (group.key === 'merch') {
    return <MerchMenuContent onNavigate={onNavigate} variant={variant} />
  }

  return (
    <div
      className={twMerge(
        variant === 'desktop'
          ? group.rail
            ? 'grid w-max items-stretch gap-6 grid-cols-[max-content_240px]'
            : 'grid w-max gap-3'
          : 'grid gap-3',
      )}
    >
      <div>
        <div
          className={twMerge(
            'grid gap-3',
            variant === 'desktop' &&
              group.sections.length > 1 &&
              'grid-cols-[repeat(2,260px)]',
          )}
        >
          {group.sections.map((section, sectionIndex) => (
            <div
              key={section.label}
              className={twMerge(
                variant === 'mobile' && sectionIndex === 0 && 'pt-1.5',
                variant === 'mobile' && sectionIndex > 0 && 'pt-3',
              )}
            >
              <div className="mb-2 px-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">
                {section.label}
              </div>
              <div
                className={twMerge(
                  'grid gap-2',
                  variant === 'desktop' &&
                    group.key === 'learn' &&
                    'grid-cols-[repeat(2,260px)]',
                  variant === 'desktop' &&
                    group.key === 'tools' &&
                    'grid-cols-[repeat(2,260px)]',
                )}
              >
                {section.items.map((item) => (
                  <MenuItemLink
                    key={`${item.label}-${item.to}-${item.hash ?? ''}`}
                    item={item}
                    onNavigate={onNavigate}
                    variant={variant}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {group.rail ? (
        <MenuRail rail={group.rail} onNavigate={onNavigate} variant={variant} />
      ) : null}
    </div>
  )
}

function LibrariesMenuContent({
  onNavigate,
  variant,
}: {
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const { openLibraries } = useLibrariesOverlay()
  const columns = getLibraryCategoryColumns()

  const allLibraries = (
    <button
      type="button"
      onClick={() => {
        openLibraries()
        onNavigate()
      }}
      className="group/all flex items-center gap-1.5 rounded-lg px-[9px] py-2 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary focus:text-text-primary focus:outline-none"
    >
      <GridFour className="size-4" />
      Browse all libraries
      <ArrowRight className="size-3.5 transition-transform group-hover/all:translate-x-0.5" />
    </button>
  )

  if (variant === 'mobile') {
    return (
      <div className="grid gap-4">
        {columns.map((column) => (
          <LibraryCategoryColumn
            key={column.category}
            column={column}
            onNavigate={onNavigate}
            variant="mobile"
          />
        ))}
        {allLibraries}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-9">
        {columns.map((column) => (
          <LibraryCategoryColumn
            key={column.category}
            column={column}
            onNavigate={onNavigate}
            variant="desktop"
          />
        ))}
      </div>
      <div className="border-t border-border-subtle pt-1.5">{allLibraries}</div>
    </div>
  )
}

function LibraryCategoryColumn({
  column,
  onNavigate,
  variant,
}: {
  column: LibraryMenuColumn
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  return (
    <div
      className={twMerge(
        'flex flex-col',
        variant === 'desktop' ? 'w-[120px] gap-4' : 'gap-1',
      )}
    >
      {/* Plain template string (not twMerge): the DS mono size utility and the
          category color are both `text-*` utilities, and twMerge would drop one. */}
      <div
        className={`pl-[9px] font-ds-mono uppercase ${
          variant === 'desktop' ? 'text-ds-mono-sm' : 'text-ds-mono-xs'
        } ${column.colorClass}`}
      >
        {column.label}
      </div>
      <div className="flex flex-col items-stretch">
        {column.libraries.map((library) => (
          <LibraryMenuRow
            key={library.id}
            library={library}
            onNavigate={onNavigate}
            variant={variant}
          />
        ))}
      </div>
    </div>
  )
}

function LibraryMenuRow({
  library,
  onNavigate,
  variant,
}: {
  library: LibraryMenuEntry
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const Icon = library.icon
  const external = library.to.startsWith('http')
  const className = twMerge(
    'group/lib flex items-center gap-2 rounded-[14px] py-2 pl-[9px] pr-3 text-text-secondary transition-colors hover:bg-surface-state-hover hover:text-text-primary focus:bg-surface-state-hover focus:text-text-primary focus:outline-none',
    variant === 'desktop' ? 'h-[38px]' : 'py-2.5',
  )
  const content = (
    <>
      {/* Plain template string: the category hover color is a `text-*` utility
          and twMerge would drop it against a base color. */}
      <Icon
        className={`size-5 shrink-0 transition-colors ${library.iconHoverColor}`}
      />
      <span className="whitespace-nowrap font-ds-display text-[16px] tracking-[0.32px]">
        {library.name}
      </span>
    </>
  )

  if (external) {
    return (
      <a
        href={library.to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      to={library.to}
      onClick={onNavigate}
      preload="intent"
      className={className}
    >
      {content}
    </Link>
  )
}

function BlogMenuContent({
  group,
  onNavigate,
  variant,
}: {
  group: NavMenuGroup
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = React.useState(false)
  const [posts, setPosts] = React.useState<Array<RecentPost>>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const root = rootRef.current
    const triggerWrap =
      variant === 'desktop'
        ? root?.closest<HTMLElement>('.ts-mega-trigger-wrap')
        : null
    const target = triggerWrap ?? root
    if (!target) return

    const load = () => setShouldLoad(true)
    target.addEventListener('pointerenter', load)
    target.addEventListener('focusin', load)

    return () => {
      target.removeEventListener('pointerenter', load)
      target.removeEventListener('focusin', load)
    }
  }, [variant])

  React.useEffect(() => {
    if (!shouldLoad) return
    let cancelled = false

    async function loadPosts() {
      setLoading(true)
      try {
        const recent = await fetchRecentPosts()
        if (!cancelled) setPosts(recent)
      } catch {
        if (!cancelled) setPosts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPosts()
    return () => {
      cancelled = true
    }
  }, [shouldLoad])

  const aboutSection = group.sections[0]

  return (
    <div
      ref={rootRef}
      className={twMerge(
        'flex flex-col gap-5',
        variant === 'desktop' && 'w-[840px]',
      )}
    >
      <section>
        <div className="mb-3 px-1 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted">
          Blog &amp; Release Notes
        </div>
        <div
          className={twMerge(
            'grid gap-3',
            variant === 'desktop' ? 'grid-cols-3' : 'grid-cols-1',
          )}
        >
          {shouldLoad && loading
            ? Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  aria-hidden
                  className="flex flex-col gap-2.5 p-2"
                >
                  <div className="aspect-video w-full animate-pulse rounded-lg bg-background-subtle" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-background-subtle" />
                  <div className="h-3 w-full animate-pulse rounded bg-background-subtle" />
                </div>
              ))
            : posts.map((post) => (
                <BlogMenuCard
                  key={post.slug}
                  post={post}
                  onNavigate={onNavigate}
                />
              ))}
        </div>
      </section>

      {aboutSection && aboutSection.items.length > 0 ? (
        <section className="border-t border-border-subtle pt-4">
          <div className="mb-2 px-1 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-muted">
            {aboutSection.label}
          </div>
          <div
            className={twMerge(
              'grid gap-1',
              variant === 'desktop' ? 'grid-cols-3' : 'grid-cols-1',
            )}
          >
            {aboutSection.items.map((item) => (
              <MenuItemLink
                key={`${item.label}-${item.to}`}
                item={item}
                onNavigate={onNavigate}
                variant={variant}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function BlogMenuCard({
  post,
  onNavigate,
}: {
  post: RecentPost
  onNavigate: () => void
}) {
  return (
    <Link
      to="/blog/$"
      params={{ _splat: post.slug } as never}
      onClick={onNavigate}
      preload="intent"
      className="group/post flex flex-col gap-2.5 rounded-xl p-2 transition-colors hover:bg-surface-state-hover"
    >
      {post.headerImage ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border-subtle">
          <img
            src={getOptimizedImageUrl(post.headerImage, {
              fit: 'cover',
              format: 'auto',
              quality: 80,
              width: 640,
            })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <CoverFallback
          slug={post.slug}
          className="aspect-video w-full rounded-lg"
        />
      )}
      <div className="flex flex-col gap-1 px-0.5">
        <div className="line-clamp-1 font-ds-display text-ds-heading-5 text-text-primary">
          {post.title}
        </div>
        <p className="line-clamp-2 text-ds-body-xs text-text-secondary">
          {post.excerpt}
        </p>
        <div className="mt-0.5 font-ds-mono text-ds-mono-xs text-text-muted">
          {formatAuthors(post.authors)} · {formatPublishedDate(post.published)}
        </div>
      </div>
    </Link>
  )
}

function MerchMenuContent({
  onNavigate,
  variant,
}: {
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = React.useState(false)
  const [products, setProducts] = React.useState<Array<ProductListItem>>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const root = rootRef.current
    const triggerWrap =
      variant === 'desktop'
        ? root?.closest<HTMLElement>('.ts-mega-trigger-wrap')
        : null
    const target = triggerWrap ?? root

    if (!target) {
      return
    }

    const load = () => {
      setShouldLoad(true)
    }

    target.addEventListener('pointerenter', load)
    target.addEventListener('focusin', load)

    return () => {
      target.removeEventListener('pointerenter', load)
      target.removeEventListener('focusin', load)
    }
  }, [variant])

  React.useEffect(() => {
    if (!shouldLoad) {
      return
    }

    let cancelled = false

    async function loadProducts() {
      setLoading(true)

      try {
        const page = await getProducts({
          data: {
            first: MERCH_MENU_PRODUCT_COUNT,
            sortKey: 'CREATED_AT',
            reverse: true,
          },
        })

        if (!cancelled) {
          setProducts(page.nodes)
        }
      } catch {
        if (!cancelled) {
          setProducts([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [shouldLoad])

  return (
    <div
      ref={rootRef}
      className={twMerge(
        'flex flex-col gap-4',
        variant === 'desktop' && 'w-[560px]',
      )}
    >
      <div
        className={twMerge(
          'grid gap-3',
          variant === 'desktop' ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {shouldLoad && loading
          ? Array.from({ length: MERCH_MENU_PRODUCT_COUNT }, (_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="aspect-square w-full animate-pulse rounded-xl bg-background-subtle"
              />
            ))
          : products.map((product) => (
              <MerchProductLink
                key={product.id}
                product={product}
                onNavigate={onNavigate}
              />
            ))}
      </div>
      <Link
        to="/shop"
        onClick={onNavigate}
        preload="intent"
        className="mx-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary focus:text-text-primary focus:outline-none"
      >
        View all
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}

function MerchProductLink({
  product,
  onNavigate,
}: {
  product: ProductListItem
  onNavigate: () => void
}) {
  const image = product.featuredImage
  const price = product.priceRange.minVariantPrice

  return (
    <Link
      to="/shop/products/$handle"
      params={{ handle: product.handle }}
      onClick={onNavigate}
      preload="intent"
      className="group/merch block overflow-hidden rounded-xl border border-border-subtle bg-background-subtle transition-colors hover:border-border-strong focus:outline-none focus-visible:border-border-strong"
      title={`${product.title} · ${formatMoney(price.amount, price.currencyCode)}`}
    >
      <div className="aspect-square w-full overflow-hidden">
        {image ? (
          <img
            src={shopifyImageUrl(image.url, { width: 400, format: 'webp' })}
            alt={image.altText ?? product.title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover/merch:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-text-muted">
            <ShoppingBag className="size-7" />
          </span>
        )}
      </div>
    </Link>
  )
}

function MenuRail({
  rail,
  onNavigate,
  variant,
}: {
  rail: NonNullable<NavMenuGroup['rail']>
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  if (variant === 'mobile') {
    return (
      <div className="pt-1">
        <MenuItemLink
          item={rail.item}
          onNavigate={onNavigate}
          variant="mobile"
          compact
        />
      </div>
    )
  }

  const external =
    rail.item.to.startsWith('http') || rail.item.to.startsWith('mailto:')
  const getInTouchClassName =
    'mt-3 inline-flex items-center gap-1.5 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary focus:text-text-primary focus:outline-none'
  const getInTouch = (
    <>
      {rail.item.label}
      {external && !rail.item.to.startsWith('mailto:') ? (
        <ArrowSquareOut className="size-3" />
      ) : null}
    </>
  )

  return (
    <aside className="flex h-full flex-col justify-between self-stretch border-l border-border-subtle pl-6">
      <div>
        <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-category-data">
          {rail.eyebrow}
        </div>
        <p className="mt-2 text-ds-body-sm text-text-secondary">
          {rail.description}
        </p>
      </div>
      <div className="mt-8">
        <div className="font-ds-display text-ds-heading-5 text-text-primary">
          {rail.title}
        </div>
        <img
          src="/images/brand/tanstack-stacked-black.svg"
          alt="TanStack"
          className="mt-3 h-11 w-auto dark:hidden"
        />
        <img
          src="/images/brand/tanstack-stacked-cream.svg"
          alt=""
          aria-hidden="true"
          className="mt-3 hidden h-11 w-auto dark:block"
        />
        {external ? (
          <a
            href={rail.item.to}
            onClick={onNavigate}
            className={getInTouchClassName}
            {...(rail.item.to.startsWith('mailto:')
              ? {}
              : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            {getInTouch}
          </a>
        ) : (
          <Link
            to={rail.item.to}
            onClick={onNavigate}
            preload="intent"
            className={getInTouchClassName}
          >
            {getInTouch}
          </Link>
        )}
      </div>
    </aside>
  )
}

function MenuItemLink({
  item,
  onNavigate,
  variant,
  compact,
}: {
  item: NavMenuItem
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
  compact?: boolean
}) {
  return (
    <MegaMenuItem
      icon={item.icon}
      title={item.label}
      description={item.description}
      to={item.to}
      hash={item.hash}
      badge={item.badge}
      onSelect={item.onSelect}
      onNavigate={() => {
        onNavigate()
        if (item.analyticsPlacement) {
          trackPartnerInquiry(item.analyticsPlacement)
        }
      }}
      variant={variant}
      compact={compact}
    />
  )
}

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com/TanStack',
    Icon: GithubIcon,
  },
  {
    label: 'Discord',
    href: 'https://tlinz.com/discord',
    Icon: DiscordIcon,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@tan_stack',
    Icon: YouTubeIcon,
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/tan_stack',
    Icon: BrandXIcon,
  },
  {
    label: 'Bluesky',
    href: 'https://bsky.app/profile/tanstack.com',
    Icon: BSkyIcon,
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/tan_stack',
    Icon: InstagramIcon,
  },
] as const

function SocialStack() {
  const stackTop = SOCIAL_LINKS.slice(0, 3)

  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          type="button"
          aria-label="TanStack social channels"
          title="Social channels"
          className="inline-flex h-9 items-center px-0"
        >
          <span className="relative inline-flex items-center">
            {stackTop.map(({ label, Icon }, i) => (
              <span
                key={label}
                className={twMerge(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-transform dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
                  i > 0 && '-ml-3',
                )}
                style={{ zIndex: stackTop.length - i }}
              >
                <Icon className="h-3 w-3" />
              </span>
            ))}
          </span>
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" sideOffset={8} className="min-w-44">
        {SOCIAL_LINKS.map(({ label, href, Icon }) => (
          <DropdownItem key={href} asChild>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`TanStack on ${label}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </a>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  )
}
