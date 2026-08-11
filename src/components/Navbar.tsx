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
const LazyMobileNavbarAuthControls = React.lazy(() =>
  import('./NavbarAuthControls').then((m) => ({
    default: m.MobileNavbarAuthControls,
  })),
)
import { NavbarCartButton } from './NavbarCartButton'
import { MegaMenuItem } from './MegaMenuItem'
import { Link, useLocation } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@phosphor-icons/react/ArrowLeft'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/ArrowSquareOut'
import { BriefcaseIcon } from '@phosphor-icons/react/Briefcase'
import { CodeIcon } from '@phosphor-icons/react/Code'
import { GridFourIcon } from '@phosphor-icons/react/GridFour'
import { HammerIcon } from '@phosphor-icons/react/Hammer'
import { HeartIcon } from '@phosphor-icons/react/Heart'
import { InfinityIcon } from '@phosphor-icons/react/Infinity'
import { LifebuoyIcon } from '@phosphor-icons/react/Lifebuoy'
import { ListIcon } from '@phosphor-icons/react/List'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/MagnifyingGlass'
import { MailboxIcon } from '@phosphor-icons/react/Mailbox'
import { NotebookIcon } from '@phosphor-icons/react/Notebook'
import { ShieldCheckIcon } from '@phosphor-icons/react/ShieldCheck'
import { ShoppingBagIcon } from '@phosphor-icons/react/ShoppingBag'
import { SignInIcon } from '@phosphor-icons/react/SignIn'
import { SparkleIcon } from '@phosphor-icons/react/Sparkle'
import { TrendUpIcon } from '@phosphor-icons/react/TrendUp'
import { UsersIcon } from '@phosphor-icons/react/Users'
import { XIcon } from '@phosphor-icons/react/X'
import { ThemeToggle } from './ThemeToggle'
import { AiDockButton, SearchButton } from './SearchButton'
import { BrandContextMenu } from './BrandContextMenu'
import { useSearchContext } from '~/contexts/SearchContext'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { publicLibraries, type LibrarySlim } from '~/libraries'
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
import { BSkyIcon } from '~/components/icons/BSkyIcon'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import { Button } from '~/components/ds/ui'
import { Collapsible, CollapsibleContent } from '~/components/Collapsible'
import { getProducts } from '~/utils/shop.functions'
import { formatMoney, shopifyImageUrl } from '~/utils/shopify-format'
import type { ProductListItem } from '~/utils/shopify-queries'
import type { PartnerPlacement } from '~/utils/analytics'
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'
import { fetchRecentPosts, type RecentPost } from '~/utils/blog.functions'

const LogoSection = () => {
  return (
    <Link
      to="/"
      aria-label="TanStack"
      className="inline-flex items-center cursor-pointer"
    >
      <img
        src="/images/brand/tanstack-landscape-black.svg"
        alt="TanStack"
        className="h-7 w-auto dark:hidden"
      />
      <img
        src="/images/brand/tanstack-landscape-white.svg"
        alt=""
        aria-hidden="true"
        className="hidden h-7 w-auto dark:block"
      />
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
            description: 'Live sessions from the maintainers.',
            icon: UsersIcon,
          },
          {
            label: 'Release Notes',
            to: '/blog',
            description: 'The latest releases and changelog.',
            icon: SparkleIcon,
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
            description: 'Real-time community support.',
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
            icon: CodeIcon,
          },
          {
            label: 'Showcase',
            to: '/showcase',
            description: 'Teams building with TanStack.',
            icon: SparkleIcon,
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
            icon: HammerIcon,
          },
          {
            label: 'Notebook',
            to: '/notebook',
            description: 'Create and share client-side TSX modules.',
            icon: NotebookIcon,
          },
          {
            label: 'Stats',
            to: '/stats/npm',
            description: 'NPM and ecosystem usage data.',
            icon: TrendUpIcon,
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
            icon: LifebuoyIcon,
          },
          {
            label: 'Partners',
            to: '/partners',
            description: 'Companies supporting TanStack.',
            icon: HeartIcon,
          },
          {
            label: 'OSS Sponsors',
            to: '/',
            hash: 'sponsors',
            description: 'Sponsors keeping TanStack open source.',
            icon: ShieldCheckIcon,
          },
          {
            label: 'Enterprise Support',
            to: '/paid-support',
            description: 'Private consulting and expert support.',
            icon: BriefcaseIcon,
          },
          {
            label: 'Contact',
            to: 'mailto:support@tanstack.com',
            description: 'Get in touch with the TanStack team.',
            icon: MailboxIcon,
          },
        ],
      },
      {
        label: 'About',
        items: [
          {
            label: 'Ethos',
            to: '/ethos',
            description: 'How we approach open source.',
            icon: ShieldCheckIcon,
          },
          {
            label: 'Tenets',
            to: '/tenets',
            description: 'The values that shape TanStack libraries.',
            icon: InfinityIcon,
          },
          {
            label: 'Design System',
            to: '/ds',
            description: 'Logos, tokens, and UI components.',
            icon: GridFourIcon,
          },
        ],
      },
    ],
    rail: {
      eyebrow: 'Partners',
      title: 'Work with',
      description: 'Sponsorships, placements, and partner pages.',
      item: {
        analyticsPlacement: 'navbar',
        label: 'Partnership Inquiry',
        to: PARTNER_INQUIRY_HREF,
        icon: MailboxIcon,
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
function getLibraryCategoryColumns(): LibraryMenuColumn[] {
  const byCategory = new Map<LibraryCategory, LibraryMenuEntry[]>(
    categoryOrder.map((category) => [category, []]),
  )

  for (const [id, category] of Object.entries(libraryCategories)) {
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
  const location = useLocation()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const desktopNavRef = React.useRef<HTMLElement>(null)
  const { openLibraries } = useLibrariesOverlay()

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
  const [mobileMenuKey, setMobileMenuKey] = React.useState<NavMenuKey | null>(
    null,
  )
  const [dismissedDesktopMenuKey, setDismissedDesktopMenuKey] =
    React.useState<NavMenuKey | null>(null)
  const [canLoadAuthControls, setCanLoadAuthControls] = React.useState(false)
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const updateScrolledState = () => {
      setIsScrolled(window.scrollY > 0)
    }

    updateScrolledState()
    window.addEventListener('scroll', updateScrolledState, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateScrolledState)
    }
  }, [])

  React.useEffect(() => {
    setMobileMenuOpen(false)
    setMobileMenuKey(null)
  }, [location.href])

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileMenuKey(null)
    }
  }, [mobileMenuOpen])

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
      <span className="hidden min-[430px]:inline">Log In</span>
      <SignInIcon className="size-4" weight="bold" />
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
        'relative w-full h-[var(--navbar-height)] px-3 py-2 min-[900px]:px-5 fixed top-0 z-[100] bg-white/90 dark:bg-black/90 backdrop-blur-lg',
        'flex items-center justify-between gap-2 min-[1120px]:gap-4',
      )}
      ref={containerRef}
    >
      <div
        aria-hidden="true"
        className={twMerge(
          'pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border-subtle opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
          isScrolled && 'opacity-100',
        )}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 min-[1120px]:gap-3">
        <BrandContextMenu
          className={twMerge(`flex items-center group shrink-0`)}
        >
          <LogoSection />
        </BrandContextMenu>
      </div>

      <nav
        ref={desktopNavRef}
        aria-label="Primary navigation"
        className={twMerge(
          DESKTOP_NAV_CLASS,
          'relative self-stretch shrink-0 items-center justify-center gap-1',
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

      <div className={DESKTOP_NAV_CLASS}>
        <SearchButton iconOnly className="h-8 w-8" />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-2.5">
        <div className={DESKTOP_SOCIAL_CLASS}>{socialLinks}</div>
        <div className={DESKTOP_NAV_CLASS}>
          <ThemeToggle />
        </div>
        <NavbarCartButton />
        <div className={DESKTOP_NAV_CLASS}>
          <AiDockButton />
        </div>
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
            <XIcon className="h-5 w-5" />
          ) : (
            <ListIcon className="h-5 w-5" />
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
            'ds-mode-dark min-h-[calc(100dvh-var(--navbar-height))] max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto',
            'border-b border-white/10 bg-[rgba(10,10,10,0.88)] text-base shadow-2xl shadow-black/50 backdrop-blur-2xl backdrop-saturate-150',
          )}
        >
          <div>
            <MobileNavigation
              key={mobileMenuOpen ? 'open' : 'closed'}
              activeKey={mobileMenuKey}
              loadAuthControls={mobileMenuOpen}
              onBack={() => setMobileMenuKey(null)}
              onNavigate={() => setMobileMenuOpen(false)}
              onOpenLibraries={() => {
                openLibraries({
                  onBack: () => setMobileMenuOpen(true),
                })
                setMobileMenuOpen(false)
              }}
              onSelect={setMobileMenuKey}
            />
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
          'bg-black/45 transition-opacity duration-200 motion-reduce:transition-none',
          siteBackdropActive ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        data-site-content
        className={twMerge(
          `min-h-[calc(100dvh-var(--navbar-height))] flex flex-col
          min-w-0 w-full overflow-x-clip transition-[filter] duration-200 motion-reduce:transition-none
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
    'text-gray-700 transition-colors group-hover/nav:bg-surface-state-hover group-hover/nav:text-gray-950 group-focus-within/nav:bg-surface-state-hover group-focus-within/nav:text-gray-950',
    'dark:text-gray-300 dark:group-hover/nav:text-white dark:group-focus-within/nav:text-white',
  )

  return (
    <div
      className="ts-mega-trigger-wrap group/nav"
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
          'border border-white/45 pt-10 px-9 pb-8 shadow-2xl shadow-black/15',
          'dark:border-white/10 dark:shadow-black/50',
          group.key === 'libraries' &&
            'min-[1120px]:px-[43px] min-[1120px]:pt-12 min-[1120px]:pb-[38px]',
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

function MobileNavigation({
  activeKey,
  loadAuthControls,
  onBack,
  onNavigate,
  onOpenLibraries,
  onSelect,
}: {
  activeKey: NavMenuKey | null
  loadAuthControls: boolean
  onBack: () => void
  onNavigate: () => void
  onOpenLibraries: () => void
  onSelect: (key: NavMenuKey) => void
}) {
  const activeGroup = NAV_GROUPS.find((group) => group.key === activeKey)
  const { openAiDock, openSearch } = useSearchContext()

  const openUtility = (utility: 'ai' | 'search') => {
    onNavigate()
    if (utility === 'search') {
      openSearch()
    } else {
      openAiDock()
    }
  }

  const signIn = (
    <Link
      to="/login"
      tabIndex={activeGroup ? -1 : 0}
      onClick={onNavigate}
      className="flex w-full items-center gap-3.5 rounded-xl px-3 py-4 text-left font-ds-display text-ds-heading-3 text-[#a3a3a3] transition-colors hover:bg-[#171717] hover:text-white focus-visible:bg-[#171717] focus-visible:text-white focus-visible:outline-none"
    >
      <SignInIcon className="size-8 shrink-0" />
      Sign In
    </Link>
  )

  return (
    <nav aria-label="Mobile navigation" className="overflow-hidden">
      <div
        className={twMerge(
          'flex w-[200%] items-start transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
          activeGroup && '-translate-x-1/2',
        )}
      >
        <div
          className="w-1/2 shrink-0 px-6 pb-12 pt-12 min-[480px]:pr-10"
          aria-hidden={Boolean(activeGroup)}
        >
          <div className="mobile-mega-menu-enter grid gap-4">
            {NAV_GROUPS.map((group) => (
              <button
                key={group.key}
                type="button"
                tabIndex={activeGroup ? -1 : 0}
                onClick={() => {
                  if (group.key === 'libraries') {
                    onOpenLibraries()
                  } else {
                    onSelect(group.key)
                  }
                }}
                className={`mobile-mega-menu-enter-item flex w-full items-center rounded-[18px] p-3 text-left font-ds-display text-ds-heading-3 text-white transition-colors hover:bg-[#171717] focus-visible:bg-[#171717] focus-visible:outline-none ${
                  group.key === 'libraries' ? 'bg-[#171717]' : ''
                }`}
              >
                <span className="min-w-0 flex-1">{group.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 border-t border-[#2e2e2e] pt-6">
            <button
              type="button"
              tabIndex={activeGroup ? -1 : 0}
              onClick={() => openUtility('search')}
              className="flex w-full items-center gap-3.5 rounded-xl px-3 py-4 text-left font-ds-display text-ds-heading-3 text-[#a3a3a3] transition-colors hover:bg-[#171717] hover:text-white focus-visible:bg-[#171717] focus-visible:text-white focus-visible:outline-none"
            >
              <MagnifyingGlassIcon className="size-8 shrink-0" />
              Search
            </button>
            <button
              type="button"
              tabIndex={activeGroup ? -1 : 0}
              onClick={() => openUtility('ai')}
              className="flex w-full items-center gap-3.5 rounded-xl px-3 py-4 text-left font-ds-display text-ds-heading-3 text-[#a3a3a3] transition-colors hover:bg-[#171717] hover:text-white focus-visible:bg-[#171717] focus-visible:text-white focus-visible:outline-none"
            >
              <SparkleIcon className="size-8 shrink-0" />
              Ask AI
            </button>
            {loadAuthControls ? (
              <React.Suspense fallback={signIn}>
                <LazyMobileNavbarAuthControls
                  tabIndex={activeGroup ? -1 : 0}
                  onNavigate={onNavigate}
                />
              </React.Suspense>
            ) : (
              signIn
            )}
          </div>
        </div>

        <div className="w-1/2 shrink-0 px-6 pb-12 pt-8">
          <button
            type="button"
            tabIndex={activeGroup ? 0 : -1}
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 rounded-xl bg-[#171717] px-3 py-2 font-ds-display text-ds-body-lg font-medium text-white transition-colors hover:bg-[#262626] focus-visible:bg-[#262626] focus-visible:outline-none"
          >
            <ArrowLeftIcon className="size-5" />
            Back
          </button>
          {activeGroup ? (
            <div key={activeGroup.key} className="mobile-mega-menu-enter">
              <MegaMenuContent
                group={activeGroup}
                onNavigate={onNavigate}
                variant="mobile"
              />
            </div>
          ) : null}
        </div>
      </div>
    </nav>
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
              (group.rail
                ? 'grid-cols-[repeat(2,260px)] min-[1120px]:grid-cols-[repeat(2,340px)]'
                : 'grid-cols-[repeat(2,minmax(300px,360px))]'),
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
              <div
                className={`mb-2 px-2 font-ds-mono text-ds-mono-sm uppercase ${variant === 'mobile' ? 'text-ds-neutral-100' : 'text-ds-neutral-300 dark:text-ds-neutral-100'}`}
              >
                {section.label}
              </div>
              <div
                className={twMerge(
                  'grid gap-2',
                  variant === 'desktop' &&
                    group.key === 'learn' &&
                    'grid-cols-[repeat(2,minmax(300px,360px))]',
                  variant === 'desktop' &&
                    group.key === 'tools' &&
                    'grid-cols-[repeat(2,minmax(300px,360px))]',
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
    <Button
      type="button"
      onClick={() => {
        openLibraries()
        onNavigate()
      }}
      variant="subtle-link"
      color="gray"
      className={twMerge(
        'group/all gap-1.5 rounded-lg px-[9px] py-2 text-ds-mono-xs focus:text-text-primary focus:outline-none',
        variant === 'desktop' &&
          'min-[1120px]:gap-[7px] min-[1120px]:rounded-[10px] min-[1120px]:px-[11px] min-[1120px]:py-2.5 min-[1120px]:text-[14px]',
      )}
    >
      <GridFourIcon
        className={twMerge(
          'size-4',
          variant === 'desktop' && 'min-[1120px]:size-[19px]',
        )}
      />
      Browse all libraries
      <ArrowRightIcon
        className={twMerge(
          'size-3.5 transition-transform group-hover/all:translate-x-0.5',
          variant === 'desktop' && 'min-[1120px]:size-[17px]',
        )}
      />
    </Button>
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
    <div className="flex flex-col gap-4 min-[1120px]:gap-5">
      <div className="flex items-start gap-9 min-[1120px]:gap-12">
        {columns.map((column) => (
          <LibraryCategoryColumn
            key={column.category}
            column={column}
            onNavigate={onNavigate}
            variant="desktop"
          />
        ))}
      </div>
      <div className="flex justify-center border-t border-border-subtle pt-1.5 min-[1120px]:pt-2">
        {allLibraries}
      </div>
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
        variant === 'desktop'
          ? 'w-[120px] gap-4 min-[1120px]:w-36 min-[1120px]:gap-5'
          : 'gap-1',
      )}
    >
      <div
        className={`pl-[9px] font-ds-mono uppercase ${
          variant === 'desktop' ? 'text-ds-mono-sm' : 'text-ds-mono-xs'
        } ${variant === 'desktop' ? 'min-[1120px]:pl-[11px]' : ''} ${column.colorClass}`}
      >
        {column.label}
      </div>
      <div className="flex flex-col items-start gap-1">
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
    // Light mode: an "elevated white" hover — a bright-white pill lifted off the
    // glass with a soft shadow + hairline ring (contrast via depth, not value).
    // Dark mode keeps the subtle white/4% (pressed 12%) overlay, no shadow/ring.
    'group/lib flex items-center gap-2 rounded-[14px] py-2 pl-[9px] pr-4 text-text-secondary transition-[color,background-color,box-shadow] hover:bg-white hover:text-text-primary hover:shadow-sm hover:ring-1 hover:ring-black/5 focus:bg-white focus:text-text-primary focus:shadow-sm focus:ring-1 focus:ring-black/5 focus:outline-none active:bg-white dark:hover:bg-text-primary/[0.04] dark:hover:shadow-none dark:hover:ring-0 dark:focus:bg-text-primary/[0.04] dark:focus:shadow-none dark:focus:ring-0 dark:active:bg-text-primary/[0.12]',
    variant === 'desktop'
      ? 'h-[38px] min-[1120px]:h-[46px] min-[1120px]:gap-2.5 min-[1120px]:rounded-[17px] min-[1120px]:pl-[11px] min-[1120px]:pr-[18px]'
      : 'py-2.5',
  )
  const content = (
    <>
      {/* Plain template string: the category hover color is a `text-*` utility
          and twMerge would drop it against a base color. */}
      <Icon
        className={`size-5 shrink-0 transition-colors ${
          variant === 'desktop' ? 'min-[1120px]:size-6' : ''
        } ${library.iconHoverColor}`}
      />
      <span
        className={twMerge(
          'whitespace-nowrap font-ds-display text-[16px] tracking-[0.32px]',
          variant === 'desktop' &&
            'min-[1120px]:text-[19px] min-[1120px]:tracking-[0.38px]',
        )}
      >
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
    if (variant === 'mobile') {
      setShouldLoad(true)
      return
    }

    const root = rootRef.current
    const triggerWrap = root?.closest<HTMLElement>('.ts-mega-trigger-wrap')
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
        variant === 'desktop' && 'w-[calc(100vw-6.5rem)] max-w-[840px] min-w-0',
      )}
    >
      <section>
        <div
          className={`mb-3 px-1 font-ds-mono text-ds-mono-xs uppercase tracking-wider ${variant === 'mobile' ? 'text-ds-neutral-100' : 'text-ds-neutral-300 dark:text-ds-neutral-100'}`}
        >
          Blog &amp; Release Notes
        </div>
        <div
          className={twMerge(
            'grid gap-4',
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
                <BlogPostCard
                  key={post.slug}
                  post={post}
                  onNavigate={onNavigate}
                  className={
                    variant === 'mobile'
                      ? 'mobile-mega-menu-enter-item'
                      : undefined
                  }
                />
              ))}
        </div>
      </section>

      {aboutSection && aboutSection.items.length > 0 ? (
        <section className="border-t border-border-subtle pt-4">
          <div
            className={`mb-2 px-1 font-ds-mono text-ds-mono-xs uppercase tracking-wider ${variant === 'mobile' ? 'text-ds-neutral-100' : 'text-ds-neutral-300 dark:text-ds-neutral-100'}`}
          >
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
        variant === 'desktop' && 'w-[calc(100vw-6.5rem)] max-w-[560px] min-w-0',
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
        className={twMerge(
          'mx-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary focus:text-text-primary focus:outline-none',
          variant === 'mobile' && 'mobile-mega-menu-enter-item',
        )}
      >
        View all
        <ArrowRightIcon className="size-3.5" />
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
      className="mobile-mega-menu-enter-item group/merch block overflow-hidden rounded-xl border border-border-subtle bg-background-subtle transition-colors hover:border-border-strong focus:outline-none focus-visible:border-border-strong"
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
            <ShoppingBagIcon className="size-7" />
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
  // Figma inset "well" shadow (neutral-400 glow + soft bottom shade), shared by
  // the rail panel and the "Get in touch" button.
  const insetWellShadow =
    'shadow-[inset_0_0_3px_0_var(--color-ds-neutral-400),inset_0_-3px_1.2px_0_rgba(0,0,0,0.25)]'
  const getInTouchClassName = `inline-flex items-center gap-1.5 self-start rounded-[11px] px-4 py-2.5 font-ds-display text-ds-body-sm font-bold text-text-muted transition-colors hover:text-text-primary focus:text-text-primary focus:outline-none ${insetWellShadow}`
  const getInTouch = (
    <>
      {rail.item.label}
      {external && !rail.item.to.startsWith('mailto:') ? (
        <ArrowSquareOutIcon className="size-3" />
      ) : null}
    </>
  )

  return (
    <aside
      className={`flex h-full flex-col gap-2.5 self-stretch rounded-2xl bg-black/[0.03] p-6 dark:bg-black/30 ${insetWellShadow}`}
    >
      <div className="font-ds-mono text-ds-mono-sm uppercase text-category-data">
        {rail.eyebrow}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-6">
        <p className="text-ds-body-sm text-text-secondary">
          {rail.description}
        </p>
        <div className="flex flex-col items-start gap-2.5">
          {/* "Work with" + the TanStack lockup read together as "Work with
              TanStack" (Figma: terracotta/200 label above the landscape mark). */}
          <div className="font-ds-display text-base font-normal text-ds-terracotta-400 dark:text-ds-terracotta-200">
            {rail.title}
          </div>
          <img
            src="/images/brand/tanstack-landscape-black.svg"
            alt="TanStack"
            className="h-9 w-auto dark:hidden"
          />
          <img
            src="/images/brand/tanstack-landscape-white.svg"
            alt=""
            aria-hidden="true"
            className="hidden h-9 w-auto dark:block"
          />
        </div>
      </div>
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
      className={
        variant === 'mobile' ? 'mobile-mega-menu-enter-item' : undefined
      }
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
          className="group/social inline-flex h-8 items-center px-0"
        >
          <span className="relative inline-flex items-center">
            {stackTop.map(({ label, Icon }, i) => (
              <span
                key={label}
                className={twMerge(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-background-default text-icon-default shadow-sm transition-[transform,color,background-color] group-hover/social:text-text-primary',
                  i > 0 && '-ml-3',
                )}
                style={{ zIndex: stackTop.length - i }}
              >
                <Icon className="size-4" />
              </span>
            ))}
          </span>
        </button>
      </DropdownTrigger>
      <DropdownContent align="center" sideOffset={8} className="min-w-44">
        {SOCIAL_LINKS.map(({ label, href, Icon }) => (
          <DropdownItem key={href} asChild>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`TanStack on ${label}`}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </a>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  )
}
