import * as React from 'react'
import { twMerge } from 'tailwind-merge'
const LazyBrandContextMenu = React.lazy(() =>
  import('./BrandContextMenu').then((m) => ({ default: m.BrandContextMenu })),
)
const LazyNavbarAuthControls = React.lazy(() =>
  import('./NavbarAuthControls').then((m) => ({
    default: m.NavbarAuthControls,
  })),
)
const LazyAiDock = React.lazy(() =>
  import('./SearchModal').then((m) => ({ default: m.AiDock })),
)
import { NavbarCartButton } from './NavbarCartButton'
import { Link, useLocation, useMatches } from '@tanstack/react-router'
import { NetlifyImage } from './NetlifyImage'
import {
  BookOpen,
  Code,
  ExternalLink,
  Grid2X2,
  Hammer,
  Heart,
  HelpCircle,
  Mail,
  Menu,
  Minus,
  Newspaper,
  Paintbrush,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { AiDockButton, SearchButton } from './SearchButton'
import { useSearchContext } from '~/contexts/SearchContext'
import {
  librariesByGroup,
  librariesGroupNamesMap,
  type LibrarySlim,
} from '~/libraries'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import { groupToSlug } from '~/components/stack/stack-categories'

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
        <NetlifyImage
          src="/images/logos/logo-color-100.png"
          alt=""
          width={30}
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

type MegaMenuDirection = 'left' | 'right' | 'down'
type MegaMenuPanePhase = 'enter' | 'exit' | 'current'

type MegaMenuPane = {
  id: number
  key: NavMenuKey
  phase: MegaMenuPanePhase
  direction: MegaMenuDirection
}

type MegaMenuLayout = {
  left: number
  width: number
}

type NavMenuItem = {
  label: string
  to: string
  hash?: string
  description?: string
  badge?: string
  icon?: IconComponent
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

type NavigationLibrary = LibrarySlim & {
  to: string
}

type LibraryGroupId = keyof typeof librariesByGroup

const DESKTOP_NAV_CLASS = 'hidden min-[1024px]:flex'
const MOBILE_NAV_CLASS = 'min-[1024px]:hidden'
const CLOSE_DELAY_MS = 140
const MEGA_MENU_TRANSITION_MS = 400
const MEGA_MENU_MAX_WIDTH = 1120
const MEGA_MENU_MIN_ALIGNED_WIDTH = 960
const MEGA_MENU_VIEWPORT_PADDING = 16
const MEGA_MENU_ORDER: Record<NavMenuKey, number> = {
  libraries: 0,
  learn: 1,
  community: 2,
  tools: 3,
  merch: 4,
  support: 5,
}
const LIBRARY_MENU_GROUP_IDS: readonly LibraryGroupId[] = [
  'framework',
  'state',
  'headlessUI',
  'performance',
  'tooling',
]

const NAV_GROUPS = [
  {
    key: 'libraries',
    label: 'Libraries',
    to: '/libraries',
    sections: [],
    rail: {
      eyebrow: 'Browse',
      title: 'All TanStack libraries',
      description:
        'Filter the ecosystem by framework and find the right package faster.',
      item: {
        label: 'All Libraries',
        to: '/libraries',
        icon: Grid2X2,
      },
    },
  },
  {
    key: 'learn',
    label: 'Learn',
    sections: [
      {
        label: 'Resources',
        items: [
          {
            label: 'Blog',
            to: '/blog',
            description: 'Release notes, architecture notes, and essays.',
            icon: Newspaper,
          },
          {
            label: 'YouTube',
            to: 'https://youtube.com/@tan_stack',
            description: 'The official TanStack channel.',
            icon: YouTubeIcon,
          },
        ],
      },
    ],
    rail: {
      eyebrow: 'Workshops',
      title: 'Learn from maintainers',
      description:
        'Remote and in-person TanStack workshops for teams that need depth.',
      item: {
        label: 'Professional Workshops',
        to: '/workshops',
        icon: Users,
      },
    },
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
    sections: [
      {
        label: 'Shop',
        items: [
          {
            label: 'New Apparel',
            to: '/merch',
            description: 'TanStack shirts, hoodies, and new drops.',
            icon: Shirt,
          },
        ],
      },
    ],
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
        ],
      },
    ],
    rail: {
      eyebrow: 'Partners',
      title: 'Work with TanStack',
      description: 'Sponsorships, placements, and partner pages.',
      item: {
        label: 'Partnership Inquiry',
        to: 'mailto:partners@tanstack.com?subject=TanStack Partnership Inquiry',
        icon: Mail,
      },
    },
  },
] as const satisfies readonly NavMenuGroup[]

function isNavigationLibrary(
  library: LibrarySlim,
): library is NavigationLibrary {
  return (
    typeof library.to === 'string' &&
    library.to.startsWith('/') &&
    library.visible !== false
  )
}

function getLibraryDisplayName(library: LibrarySlim) {
  return library.name.replace(/^TanStack\s+/, '')
}

function isExternalLink(to: string) {
  return to.startsWith('http') || to.startsWith('mailto:')
}

function getLibraryDocsTo(library: NavigationLibrary) {
  return `${library.to}/latest/docs`
}

function getMenuGroup(key: NavMenuKey) {
  return NAV_GROUPS.find((group) => group.key === key)
}

function getLibraryMenuGroups() {
  return LIBRARY_MENU_GROUP_IDS.map((groupId) => {
    const groupLibraries = librariesByGroup[groupId]
    const libraries = groupLibraries.filter(isNavigationLibrary)

    return {
      id: groupId,
      label: librariesGroupNamesMap[groupId],
      libraries,
    }
  }).filter((group) => group.libraries.length > 0)
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

  const { Title } = React.useMemo(() => {
    const match = [...matches].reverse().find((m) => m.staticData.Title)

    return {
      Title: match?.staticData.Title ?? null,
    }
  }, [matches])

  const containerRef = React.useRef<HTMLDivElement>(null)
  const primaryNavRef = React.useRef<HTMLElement>(null)
  const megaMenuRef = React.useRef<HTMLDivElement>(null)
  const closeTimerRef = React.useRef<number | undefined>(undefined)
  const activeMenuKeyRef = React.useRef<NavMenuKey | null>(null)

  React.useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.offsetHeight
        document.documentElement.style.setProperty(
          '--navbar-height',
          `${height}px`,
        )
      }
    }

    updateContainerHeight()

    window.addEventListener('resize', updateContainerHeight)
    return () => {
      window.removeEventListener('resize', updateContainerHeight)
    }
  }, [])

  const [activeMenuKey, setActiveMenuKey] = React.useState<NavMenuKey | null>(
    null,
  )
  const [megaMenuDirection, setMegaMenuDirection] =
    React.useState<MegaMenuDirection>('down')
  const [megaMenuLayout, setMegaMenuLayout] = React.useState<MegaMenuLayout>({
    left: MEGA_MENU_VIEWPORT_PADDING,
    width: MEGA_MENU_MAX_WIDTH,
  })
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [canLoadAuthControls, setCanLoadAuthControls] = React.useState(false)

  React.useEffect(() => {
    document.documentElement.classList.add('ts-nav-hydrated')

    return () => {
      document.documentElement.classList.remove('ts-nav-hydrated')
    }
  }, [])

  const closeMegaMenu = React.useCallback(() => {
    activeMenuKeyRef.current = null
    setActiveMenuKey(null)
  }, [])

  const cancelMegaMenuClose = React.useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }, [])

  const scheduleMegaMenuClose = React.useCallback(() => {
    cancelMegaMenuClose()
    closeTimerRef.current = window.setTimeout(() => {
      closeMegaMenu()
    }, CLOSE_DELAY_MS)
  }, [cancelMegaMenuClose, closeMegaMenu])

  const updateMegaMenuLayout = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const trigger =
      primaryNavRef.current?.querySelector<HTMLElement>('.ts-mega-trigger')
    const viewportWidth = window.innerWidth
    const availableWidth = Math.max(
      0,
      viewportWidth - MEGA_MENU_VIEWPORT_PADDING * 2,
    )
    const triggerLeft = Math.round(
      trigger?.getBoundingClientRect().left ?? MEGA_MENU_VIEWPORT_PADDING,
    )
    const alignedWidth = Math.min(
      MEGA_MENU_MAX_WIDTH,
      Math.max(0, viewportWidth - triggerLeft - MEGA_MENU_VIEWPORT_PADDING),
    )
    const nextLayout =
      alignedWidth >= MEGA_MENU_MIN_ALIGNED_WIDTH
        ? {
            left: triggerLeft,
            width: alignedWidth,
          }
        : {
            left: MEGA_MENU_VIEWPORT_PADDING,
            width: availableWidth,
          }

    setMegaMenuLayout((previousLayout) => {
      if (
        previousLayout.left === nextLayout.left &&
        previousLayout.width === nextLayout.width
      ) {
        return previousLayout
      }

      return nextLayout
    })
  }, [])

  const openMegaMenu = React.useCallback(
    (key: NavMenuKey) => {
      cancelMegaMenuClose()
      updateMegaMenuLayout()
      const previousKey = activeMenuKeyRef.current

      if (previousKey && previousKey !== key) {
        setMegaMenuDirection(
          MEGA_MENU_ORDER[key] > MEGA_MENU_ORDER[previousKey]
            ? 'right'
            : 'left',
        )
      } else if (!previousKey) {
        setMegaMenuDirection('down')
      }

      activeMenuKeyRef.current = key
      setActiveMenuKey(key)
    },
    [cancelMegaMenuClose, updateMegaMenuLayout],
  )

  React.useEffect(() => {
    if (!activeMenuKey) {
      return
    }

    updateMegaMenuLayout()
    window.addEventListener('resize', updateMegaMenuLayout)

    return () => {
      window.removeEventListener('resize', updateMegaMenuLayout)
    }
  }, [activeMenuKey, updateMegaMenuLayout])

  React.useEffect(() => {
    closeMegaMenu()
    setMobileMenuOpen(false)
  }, [closeMegaMenu, location.pathname, location.hash])

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(
        () => {
          setCanLoadAuthControls(true)
        },
        { timeout: 3000 },
      )

      return () => {
        window.cancelIdleCallback(idleId)
      }
    }

    const timeout = window.setTimeout(() => {
      setCanLoadAuthControls(true)
    }, 3000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [])

  React.useEffect(() => {
    if (!activeMenuKey && !mobileMenuOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMegaMenu()
        setMobileMenuOpen(false)
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!activeMenuKey) {
        return
      }

      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (
        containerRef.current?.contains(target) ||
        megaMenuRef.current?.contains(target)
      ) {
        return
      }

      closeMegaMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [activeMenuKey, closeMegaMenu, mobileMenuOpen])

  React.useEffect(() => {
    return () => {
      cancelMegaMenuClose()
    }
  }, [cancelMegaMenuClose])

  const loginButtonFallback = (
    <Link
      to="/login"
      aria-label="Log In"
      className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 whitespace-nowrap
             bg-black dark:bg-white text-white dark:text-black
             hover:bg-gray-800 dark:hover:bg-gray-200
             transition-colors duration-200 text-xs font-medium"
    >
      <User className="w-3.5 h-3.5" />
      <span className="hidden min-[430px]:inline">Log In</span>
    </Link>
  )

  const socialLinks = <SocialStack />

  const navbar = (
    <div
      className={twMerge(
        'w-full p-2 fixed top-0 z-[100] bg-white/90 dark:bg-black/90 backdrop-blur-lg',
        'flex items-center justify-between gap-3',
        'border-b border-gray-500/20',
      )}
      ref={containerRef}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-center gap-2 font-black text-xl uppercase min-w-0">
          <React.Suspense fallback={<LogoSection title={Title} />}>
            <LazyBrandContextMenu
              className={twMerge(`flex items-center group flex-shrink-0`)}
            >
              <LogoSection title={Title} />
            </LazyBrandContextMenu>
          </React.Suspense>
          {Title ? (
            <div className="truncate">
              <Title />
            </div>
          ) : null}
        </div>

        <nav
          ref={primaryNavRef}
          aria-label="Primary navigation"
          className={twMerge(
            DESKTOP_NAV_CLASS,
            'relative shrink-0 items-center gap-1',
          )}
          onPointerEnter={cancelMegaMenuClose}
          onPointerLeave={(event) => {
            if (event.pointerType === 'touch') return
            scheduleMegaMenuClose()
          }}
        >
          {NAV_GROUPS.map((group) => (
            <DesktopNavTrigger
              key={group.key}
              group={group}
              isOpen={activeMenuKey === group.key}
              onOpen={() => openMegaMenu(group.key)}
            />
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden min-[750px]:block">{socialLinks}</div>
        <ThemeToggle />
        <div className="hidden sm:block">
          <SearchButton iconOnly />
        </div>
        <NavbarCartButton />
        <AiDockButton />
        <div className="flex items-center gap-2">
          {canLoadAuthControls ? (
            <React.Suspense fallback={loginButtonFallback}>
              <LazyNavbarAuthControls />
            </React.Suspense>
          ) : (
            loginButtonFallback
          )}
        </div>
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-mobile-menu"
          className={twMerge(
            'inline-flex h-9 w-9 items-center justify-center rounded-md',
            'border border-gray-500/20 text-gray-700 transition-colors hover:bg-gray-500/10',
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

  const desktopMegaMenu = (
    <div
      ref={megaMenuRef}
      className={twMerge(
        DESKTOP_NAV_CLASS,
        'fixed left-0 right-0 top-[var(--navbar-height)] z-[90] justify-start',
        'pointer-events-none',
      )}
    >
      <div
        data-open={activeMenuKey ? 'true' : 'false'}
        style={{
          marginLeft: megaMenuLayout.left,
          width: megaMenuLayout.width,
        }}
        className={twMerge(
          'ts-mega-panel ts-glass-menu mt-2 rounded-xl',
          'border border-white/45 bg-white/80 p-4 shadow-2xl shadow-black/15 backdrop-blur-2xl backdrop-saturate-150',
          'dark:border-white/10 dark:bg-black/70 dark:shadow-black/50',
        )}
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return
          cancelMegaMenuClose()
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'touch') return
          scheduleMegaMenuClose()
        }}
      >
        <MegaMenuContentTransition
          activeKey={activeMenuKey}
          direction={megaMenuDirection}
          onNavigate={closeMegaMenu}
        />
      </div>
    </div>
  )

  const mobileMenu = mobileMenuOpen ? (
    <div
      id="primary-mobile-menu"
      data-mobile-menu
      className={twMerge(
        MOBILE_NAV_CLASS,
        'fixed left-0 right-0 top-[var(--navbar-height)] z-[90] isolate',
        'max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto',
        'border-b border-white/45 bg-white/85 text-base shadow-2xl shadow-black/15 backdrop-blur-2xl backdrop-saturate-150',
        'dark:border-white/10 dark:bg-black/75 dark:shadow-black/50',
      )}
    >
      <div className="border-t border-white/30 dark:border-white/10">
        <div className="p-2 sm:hidden">
          <SearchButton className="w-full py-3 text-base [&_svg]:w-5 [&_svg]:h-5" />
        </div>
        <nav className="grid gap-1.5 px-2 pb-2" aria-label="Mobile navigation">
          {NAV_GROUPS.map((group) => (
            <MobileMenuGroup
              key={group.key}
              group={group}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          ))}
        </nav>
        <div className="border-t border-gray-500/10 p-3 sm:hidden">
          {socialLinks}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {navbar}
      {desktopMegaMenu}
      {mobileMenu}
      <div
        aria-hidden="true"
        data-site-menu-tint
        className={twMerge(
          DESKTOP_NAV_CLASS,
          'pointer-events-none fixed inset-x-0 bottom-0 top-[var(--navbar-height)] z-[80]',
          'bg-white/45 transition-opacity duration-200 motion-reduce:transition-none dark:bg-black/45',
          activeMenuKey ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        data-site-content
        className={twMerge(
          `min-h-[calc(100dvh-var(--navbar-height))] flex flex-col
          min-w-0 w-full transition-[filter] duration-200 motion-reduce:transition-none
          pt-[var(--navbar-height)]`,
          activeMenuKey ? 'blur-[4px]' : 'filter-none',
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
  isOpen,
  onOpen,
}: {
  group: NavMenuGroup
  isOpen: boolean
  onOpen: () => void
}) {
  const triggerClassName = twMerge(
    'ts-mega-trigger inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-bold',
    'text-gray-700 transition-colors hover:bg-gray-500/10 hover:text-gray-950',
    'dark:text-gray-300 dark:hover:text-white',
    isOpen && 'bg-gray-500/10 text-gray-950 dark:text-white',
  )
  const triggerEvents = {
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch') return
      onOpen()
    },
    onFocus: onOpen,
  }

  return (
    <div className="ts-mega-trigger-wrap">
      {group.to ? (
        <Link
          to={group.to}
          data-open={isOpen ? 'true' : 'false'}
          className={triggerClassName}
          preload="intent"
          {...triggerEvents}
        >
          <span>{group.label}</span>
        </Link>
      ) : (
        <button
          type="button"
          data-open={isOpen ? 'true' : 'false'}
          className={triggerClassName}
          onClick={onOpen}
          {...triggerEvents}
        >
          <span>{group.label}</span>
        </button>
      )}
      <DesktopNavFallback group={group} />
    </div>
  )
}

function DesktopNavFallback({ group }: { group: NavMenuGroup }) {
  return (
    <div className="ts-mega-fallback">
      <div
        className={twMerge(
          'ts-glass-menu rounded-xl',
          'border border-white/45 bg-white/80 p-4 shadow-2xl shadow-black/15 backdrop-blur-2xl backdrop-saturate-150',
          'dark:border-white/10 dark:bg-black/70 dark:shadow-black/50',
        )}
      >
        <MegaMenuContent
          group={group}
          onNavigate={() => undefined}
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
  return (
    <Collapsible className="overflow-hidden rounded-lg border border-gray-500/10 bg-white/35 dark:border-white/10 dark:bg-white/[0.03]">
      {({ open }) => (
        <>
          {group.to ? (
            <div className="flex items-center">
              <Link
                to={group.to}
                onClick={onNavigate}
                className={twMerge(
                  'min-w-0 flex-1 px-3 py-3 text-left font-black text-gray-800',
                  'hover:text-gray-950 focus:outline-none dark:text-gray-200 dark:hover:text-white',
                  open && 'text-gray-950 dark:text-white',
                )}
                preload="intent"
              >
                {group.label}
              </Link>
              <CollapsibleTrigger
                aria-label={`${open ? 'Collapse' : 'Expand'} ${group.label}`}
                className={twMerge(
                  'mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600',
                  'hover:bg-gray-500/10 hover:text-gray-950 focus:bg-gray-500/10 focus:text-gray-950 focus:outline-none',
                  'dark:text-gray-300 dark:hover:text-white dark:focus:text-white',
                )}
              >
                {open ? (
                  <Minus className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
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

function MegaMenuContentTransition({
  activeKey,
  direction,
  onNavigate,
}: {
  activeKey: NavMenuKey | null
  direction: MegaMenuDirection
  onNavigate: () => void
}) {
  const previousActiveRef = React.useRef<NavMenuKey | null>(null)
  const paneIdRef = React.useRef(0)
  const [panes, setPanes] = React.useState<readonly MegaMenuPane[]>([])

  React.useLayoutEffect(() => {
    if (activeKey === null) {
      previousActiveRef.current = null
      setPanes([])
      return
    }

    const previousActive = previousActiveRef.current
    if (previousActive === activeKey) {
      return
    }

    const transitionDirection = previousActive ? direction : 'down'
    const enteringPane: MegaMenuPane = {
      id: paneIdRef.current + 1,
      key: activeKey,
      phase: 'enter',
      direction: transitionDirection,
    }
    paneIdRef.current += 1

    const nextPanes: MegaMenuPane[] = previousActive
      ? [
          {
            id: paneIdRef.current + 1,
            key: previousActive,
            phase: 'exit',
            direction: transitionDirection,
          },
          enteringPane,
        ]
      : [enteringPane]

    if (previousActive) {
      paneIdRef.current += 1
    }

    previousActiveRef.current = activeKey
    setPanes(nextPanes)

    const timeoutId = window.setTimeout(() => {
      setPanes([{ ...enteringPane, phase: 'current' }])
    }, MEGA_MENU_TRANSITION_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeKey, direction])

  if (panes.length === 0) {
    return null
  }

  return (
    <div className="ts-mega-content">
      {panes.map((pane) => {
        const group = getMenuGroup(pane.key)

        if (!group) {
          return null
        }

        return (
          <div
            key={pane.id}
            className="ts-mega-pane"
            data-direction={pane.direction}
            data-state={pane.phase}
            aria-hidden={pane.phase === 'exit'}
          >
            <MegaMenuContent
              group={group}
              onNavigate={onNavigate}
              variant="desktop"
            />
          </div>
        )
      })}
    </div>
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

  return (
    <div
      className={twMerge(
        variant === 'desktop'
          ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]'
          : 'grid gap-3',
      )}
    >
      <div>
        <div
          className={twMerge(
            'grid gap-3',
            variant === 'desktop' &&
              group.sections.length > 1 &&
              'md:grid-cols-2',
          )}
        >
          {group.sections.map((section) => (
            <div key={section.label}>
              <div className="mb-2 px-2 text-xs font-black uppercase text-gray-500 dark:text-gray-400">
                {section.label}
              </div>
              <div
                className={twMerge(
                  'grid gap-1',
                  variant === 'desktop' &&
                    group.key === 'learn' &&
                    'md:grid-cols-2',
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
  const libraryMenuGroups = getLibraryMenuGroups()

  return (
    <div
      className={twMerge(
        variant === 'desktop'
          ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]'
          : 'grid gap-3',
      )}
    >
      <div>
        <div
          className={twMerge(
            variant === 'desktop'
              ? 'max-h-[min(72dvh,680px)] columns-2 overflow-y-auto pr-2 [column-gap:1rem]'
              : 'grid gap-3',
          )}
        >
          {libraryMenuGroups.map((group) => (
            <LibraryMenuGroup
              key={group.id}
              group={group}
              onNavigate={onNavigate}
              variant={variant}
            />
          ))}
        </div>
      </div>
      <MenuRail
        rail={{
          eyebrow: 'Browse',
          title: 'All TanStack libraries',
          description:
            'Filter by framework and compare the full set of public packages.',
          item: {
            label: 'All Libraries',
            to: '/libraries',
            icon: Grid2X2,
          },
        }}
        onNavigate={onNavigate}
        variant={variant}
      />
    </div>
  )
}

function LibraryMenuGroup({
  group,
  onNavigate,
  variant,
}: {
  group: ReturnType<typeof getLibraryMenuGroups>[number]
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const categorySlug = groupToSlug[group.id]

  return (
    <section
      className={twMerge(
        'break-inside-avoid',
        variant === 'desktop' ? 'mb-5 [break-inside:avoid]' : 'pb-3',
      )}
    >
      <div className="mb-1.5 px-1">
        <Link
          to="/stack/$category"
          params={{ category: categorySlug }}
          onClick={onNavigate}
          className="inline-flex rounded px-1 py-0.5 text-xs font-black uppercase text-gray-500 hover:bg-gray-500/10 hover:text-gray-950 focus:bg-gray-500/10 focus:text-gray-950 focus:outline-none dark:text-gray-400 dark:hover:text-white dark:focus:text-white"
          preload="intent"
        >
          {group.label}
        </Link>
      </div>
      <div className="grid gap-0.5">
        {group.libraries.map((library) => (
          <LibraryMenuItem
            key={library.id}
            library={library}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

function LibraryMenuItem({
  library,
  onNavigate,
}: {
  library: NavigationLibrary
  onNavigate: () => void
}) {
  const name = getLibraryDisplayName(library)
  const docsTo = getLibraryDocsTo(library)

  return (
    <div data-library-menu-item className="flex items-center gap-1.5">
      <Link
        to={library.to}
        onClick={onNavigate}
        className="group/library flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm font-black text-gray-900 hover:bg-gray-500/10 focus:bg-gray-500/10 focus:outline-none dark:text-gray-100"
        preload="intent"
      >
        <span
          className={twMerge(
            'h-4 w-3.5 shrink-0 rounded border border-white/50',
            library.bgStyle,
          )}
        />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate">{name}</span>
          {library.badge ? (
            <span
              data-library-badge
              className={twMerge(
                'hidden shrink-0 rounded-md border border-current px-1.5 py-0.5 text-[0.58rem] font-black uppercase leading-none',
                'group-hover/library:inline-flex group-focus-within/library:inline-flex',
                library.textStyle,
              )}
            >
              {library.badge}
            </span>
          ) : null}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          to={docsTo}
          onClick={onNavigate}
          className="rounded-lg px-2 py-2 text-xs font-bold text-gray-600 hover:bg-gray-500/10 hover:text-gray-950 focus:bg-gray-500/10 focus:text-gray-950 focus:outline-none dark:text-gray-400 dark:hover:text-white dark:focus:text-white"
          preload="intent"
        >
          Docs
        </Link>
      </div>
    </div>
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

  return (
    <aside className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="text-xs font-black uppercase text-gray-500 dark:text-gray-400">
        {rail.eyebrow}
      </div>
      <div className="mt-2 text-base font-black text-gray-950 dark:text-white">
        {rail.title}
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
        {rail.description}
      </p>
      <div className="mt-4">
        <MenuItemLink
          item={rail.item}
          onNavigate={onNavigate}
          variant="desktop"
          compact
        />
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
  const Icon = item.icon
  const isExternal = isExternalLink(item.to)
  const className = twMerge(
    'group flex items-start gap-3 rounded-lg px-2 py-2.5 text-left',
    'hover:bg-gray-500/10 focus:bg-gray-500/10 focus:outline-none',
    compact && 'bg-white dark:bg-black/40',
    variant === 'mobile' && 'px-2 py-3',
  )
  const content = (
    <>
      {Icon ? (
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-bold text-gray-950 dark:text-white">
            {item.label}
          </span>
          {item.badge ? (
            <span className="rounded-md border border-green-500/50 px-1.5 py-0.5 text-[0.6rem] font-black uppercase leading-none text-green-600 dark:text-green-400">
              {item.badge}
            </span>
          ) : null}
          {isExternal && !item.to.startsWith('mailto:') ? (
            <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
          ) : null}
        </span>
        {item.description ? (
          <span className="mt-0.5 block text-sm leading-5 text-gray-600 dark:text-gray-400">
            {item.description}
          </span>
        ) : null}
      </span>
    </>
  )

  if (isExternal) {
    return (
      <a
        href={item.to}
        target={item.to.startsWith('mailto:') ? undefined : '_blank'}
        rel={item.to.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
        className={className}
        onClick={onNavigate}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      to={item.to}
      hash={item.hash}
      className={className}
      onClick={onNavigate}
      preload="intent"
    >
      {content}
    </Link>
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
          className="inline-flex h-9 items-center pl-1 pr-2"
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
