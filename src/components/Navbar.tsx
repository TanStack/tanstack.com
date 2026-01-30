import * as React from 'react'
import { twMerge } from 'tailwind-merge'
const LazyBrandContextMenu = React.lazy(() =>
  import('./BrandContextMenu').then((m) => ({ default: m.BrandContextMenu })),
)
import {
  Link,
  useLocation,
  useMatches,
  useNavigate,
} from '@tanstack/react-router'
import { NetlifyImage } from './NetlifyImage'
import {
  Code,
  Users,
  Music,
  HelpCircle,
  BookOpen,
  TrendingUp,
  Shirt,
  ShieldCheck,
  Paintbrush,
  Hammer,
  User,
  Menu,
  X,
  Rss,
  Grid2X2,
  Sparkles,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { SearchButton } from './SearchButton'
// const LazyFeedTicker = React.lazy(() =>
//   import('./FeedTicker').then((m) => ({ default: m.FeedTicker })),
// )
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from '~/components/AuthComponents'
import {
  libraries,
  findLibrary,
  SIDEBAR_LIBRARY_IDS,
  type LibrarySlim,
} from '~/libraries'
import { ADMIN_ACCESS_CAPABILITIES } from '~/db/types'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUser } from '~/hooks/useCurrentUser'
import { useClickOutside } from '~/hooks/useClickOutside'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { DiscordIcon } from '~/components/icons/DiscordIcon'
import { InstagramIcon } from '~/components/icons/InstagramIcon'
import { BSkyIcon } from '~/components/icons/BSkyIcon'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
const LazyAnnouncementBanner = React.lazy(() =>
  import('~/components/AnnouncementBanner').then((m) => ({
    default: m.AnnouncementBanner,
  })),
)
const LazyAuthenticatedUserMenu = React.lazy(() =>
  import('~/components/AuthenticatedUserMenu').then((m) => ({
    default: m.AuthenticatedUserMenu,
  })),
)
import { authClient } from '~/utils/auth.client'
import { useToast } from '~/components/ToastProvider'

import { Card } from '~/components/Card'

type LogoProps = {
  showMenu: boolean
  setShowMenu: React.Dispatch<React.SetStateAction<boolean>>
  menuButtonRef: React.RefObject<HTMLButtonElement | null>
  title?: React.ComponentType<any> | null
}

const LogoSection = ({
  showMenu,
  setShowMenu,
  menuButtonRef,
  title,
}: LogoProps) => {
  const pointerInsideButtonRef = React.useRef(false)
  const toggleMenu = () => {
    setShowMenu((prev) => !prev)
  }
  return (
    <>
      <button
        aria-label="Open Menu"
        className={twMerge(
          'flex items-center justify-center',
          'transition-all duration-300 h-8 px-2 py-1 lg:px-0',
          // At lg: only visible when Title exists (flyout mode)
          // Below lg: always visible
          title
            ? 'lg:w-9 lg:opacity-100 lg:translate-x-0'
            : 'lg:w-0 lg:opacity-0 lg:-translate-x-full',
        )}
        ref={menuButtonRef}
        onClick={toggleMenu}
        onPointerEnter={(e) => {
          // Enable hover to open flyout at md+ (but not touch)
          if (window.innerWidth < 768 || e.pointerType === 'touch') return
          if (pointerInsideButtonRef.current) return
          pointerInsideButtonRef.current = true
          setShowMenu(true)
        }}
        onPointerLeave={() => {
          pointerInsideButtonRef.current = false
        }}
      >
        {showMenu ? <X /> : <Menu />}
      </button>
      <Link
        to="/"
        className={twMerge(`inline-flex items-center gap-1.5 cursor-pointer`)}
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
    </>
  )
}

const MobileCard = ({
  children,
  isActive,
}: {
  children: React.ReactNode
  isActive?: boolean
}) => (
  <Card
    className={twMerge(
      'md:contents border-gray-200/50 dark:border-gray-700/50 shadow-sm',
      isActive && 'ring-2 ring-gray-400/30 dark:ring-gray-500/30',
    )}
  >
    {children}
  </Card>
)

export function Navbar({ children }: { children: React.ReactNode }) {
  const matches = useMatches()
  const capabilities = useCapabilities()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { notify } = useToast()

  const signOut = async () => {
    await authClient.signOut()
    navigate({ to: '/login' })
    notify(
      <div>
        <div className="font-medium">Signed out</div>
        <div className="text-gray-500 dark:text-gray-400 text-xs">
          You have been logged out
        </div>
      </div>,
    )
  }

  const { Title, library } = React.useMemo(() => {
    const match = [...matches].reverse().find((m) => m.staticData.Title)
    const params = match?.params as { libraryId?: string } | undefined
    const libraryId = params?.libraryId

    return {
      Title: match?.staticData.Title ?? null,
      library: libraryId ? findLibrary(libraryId) : null,
    }
  }, [matches])

  const canAdmin = capabilities.some((cap) =>
    (ADMIN_ACCESS_CAPABILITIES as readonly string[]).includes(cap),
  )

  const canApiKeys = !!user // Any logged-in user can access API keys

  const containerRef = React.useRef<HTMLDivElement>(null)

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

    updateContainerHeight() // Initial call to set the height

    window.addEventListener('resize', updateContainerHeight)
    return () => {
      window.removeEventListener('resize', updateContainerHeight)
    }
  }, [])

  const [showMenu, setShowMenu] = React.useState(false)
  const largeMenuRef = React.useRef<HTMLDivElement>(null)
  const menuButtonRef = React.useRef<HTMLButtonElement>(null)

  // Close mobile menu when clicking outside
  const smallMenuRef = useClickOutside<HTMLDivElement>({
    enabled: showMenu,
    onClickOutside: () => setShowMenu(false),
    additionalRefs: [largeMenuRef, menuButtonRef],
  })

  const loginButton = (
    <>
      {(() => {
        const loginEl = (
          <Link
            to="/login"
            className="flex items-center gap-1 rounded-md px-2 py-1.5
            bg-black dark:bg-white text-white dark:text-black
            hover:bg-gray-800 dark:hover:bg-gray-200
            transition-colors duration-200 text-xs font-medium"
          >
            <User className="w-3.5 h-3.5" />
            <span>Log In</span>
          </Link>
        )

        return (
          <>
            <AuthLoading>{loginEl}</AuthLoading>
            <Unauthenticated>{loginEl}</Unauthenticated>
          </>
        )
      })()}

      <Authenticated>
        <React.Suspense fallback={<div className="w-[26px] h-[26px]" />}>
          <LazyAuthenticatedUserMenu
            user={user ?? null}
            canAdmin={canAdmin}
            canApiKeys={canApiKeys}
            onSignOut={signOut}
          />
        </React.Suspense>
      </Authenticated>
    </>
  )

  const socialLinks = (
    <div className="flex items-center [&_a]:p-1.5 [&_a]:opacity-50 [&_a:hover]:opacity-100 [&_a]:transition-opacity [&_svg]:text-sm">
      <a
        href={`https://github.com/${library?.repo ?? 'tanstack'}`}
        aria-label={`Follow ${library?.name ?? 'TanStack'} on GitHub`}
      >
        <GithubIcon />
      </a>
      <a href="https://x.com/tan_stack" aria-label="Follow TanStack on X.com">
        <BrandXIcon />
      </a>
      <a
        href="https://bsky.app/profile/tanstack.com"
        aria-label="Follow TanStack on Besky"
      >
        <BSkyIcon />
      </a>
      <a
        href="https://instagram.com/tan_stack"
        aria-label="Follow TanStack on Instagram"
      >
        <InstagramIcon />
      </a>
      <a href="https://tlinz.com/discord" aria-label="Join TanStack Discord">
        <DiscordIcon />
      </a>
    </div>
  )

  const navbar = (
    <div
      className={twMerge(
        'w-full p-2 fixed top-0 z-[100] bg-white/90 dark:bg-black/90 backdrop-blur-lg',
        'flex items-center justify-between gap-4',
        'border-b border-gray-500/20',
      )}
      ref={containerRef}
    >
      <div className="flex items-center min-w-0">
        <div className="flex items-center gap-2 font-black text-xl uppercase min-w-0">
          <React.Suspense
            fallback={
              <LogoSection
                menuButtonRef={menuButtonRef}
                setShowMenu={setShowMenu}
                showMenu={showMenu}
                title={Title}
              />
            }
          >
            <LazyBrandContextMenu
              className={twMerge(`flex items-center group flex-shrink-0`)}
            >
              <LogoSection
                menuButtonRef={menuButtonRef}
                setShowMenu={setShowMenu}
                showMenu={showMenu}
                title={Title}
              />
            </LazyBrandContextMenu>
          </React.Suspense>
          {Title ? (
            <div className="truncate">
              <Title />
            </div>
          ) : null}
        </div>
      </div>
      <div className="hidden xl:flex flex-1 justify-end min-w-0">
        <Link
          to="/$libraryId/$version"
          params={{ libraryId: 'cli', version: 'latest' }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
            bg-gradient-to-r from-indigo-600 to-violet-700
            hover:from-indigo-500 hover:to-violet-600
            text-white text-xs font-medium
            shadow-sm hover:shadow-md
            transition-all duration-200"
        >
          <span className="px-1 py-px text-[9px] font-bold bg-white/20 rounded uppercase">
            Alpha
          </span>
          <span>Try TanStack CLI</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden min-[750px]:block">{socialLinks}</div>
        <div className="hidden sm:block">
          <SearchButton />
        </div>
        <ThemeToggle />
        <div className="flex items-center gap-2">{loginButton}</div>
      </div>
    </div>
  )

  const activeLibrary = useLocation({
    select: (location) => {
      return libraries.find((library) => {
        return library.to && location.pathname.startsWith(library.to)
      })
    },
  })

  const linkClasses = `flex items-center justify-between gap-2 group px-3 py-3 md:px-2 md:py-1 rounded-lg hover:bg-gray-500/10 font-bold text-base md:text-sm`

  const items = (
    <div className="contents md:block">
      <div className="contents md:block">
        {(() => {
          return libraries
            .filter(
              (
                d,
              ): d is LibrarySlim & {
                to: string
                textStyle: string
                badge?: string
                colorFrom: string
              } =>
                d.to !== undefined &&
                d.visible !== false &&
                (SIDEBAR_LIBRARY_IDS as readonly string[]).includes(d.id),
            )
            .sort((a, b) => {
              const indexA = SIDEBAR_LIBRARY_IDS.indexOf(
                a.id as (typeof SIDEBAR_LIBRARY_IDS)[number],
              )
              const indexB = SIDEBAR_LIBRARY_IDS.indexOf(
                b.id as (typeof SIDEBAR_LIBRARY_IDS)[number],
              )
              return indexA - indexB
            })
        })().map((library, i) => {
          const [_, name] = library.name.split(' ')
          const isActive = library.to === activeLibrary?.to

          return (
            <div key={i} className="contents md:block">
              {library.to?.startsWith('http') ? (
                <>
                  {/* Mobile: Card wrapper */}
                  <MobileCard>
                    <a
                      href={library.to}
                      className={twMerge(linkClasses, 'md:hidden')}
                    >
                      <span
                        className={twMerge(
                          'w-4 h-4 md:w-3 md:h-3 rounded-sm border border-white/50',
                          library.bgStyle,
                        )}
                      />
                      {name}
                    </a>
                  </MobileCard>
                  {/* Desktop: no card */}
                  <a
                    href={library.to}
                    className={twMerge(linkClasses, 'hidden md:flex')}
                  >
                    <span
                      className={twMerge(
                        'w-3 h-3 rounded-sm border border-white/50',
                        library.bgStyle,
                      )}
                    />
                    {name}
                  </a>
                </>
              ) : (
                <>
                  {/* Mobile: Direct link with Card */}
                  <MobileCard isActive={isActive}>
                    <Link
                      to="/$libraryId/$version"
                      params={{ libraryId: library.id, version: 'latest' }}
                      className={twMerge(
                        linkClasses,
                        'md:hidden',
                        isActive ? 'bg-gray-500/5' : '',
                      )}
                    >
                      <span
                        className={twMerge(
                          'w-4 h-4 md:w-3 md:h-3 rounded-sm',
                          library.bgStyle,
                        )}
                      />
                      <span
                        style={{
                          viewTransitionName: `library-name-${library.id}`,
                        }}
                        className={twMerge(
                          'flex-1 text-left',
                          isActive ? 'font-bold' : '',
                        )}
                      >
                        {name}
                      </span>
                      {library.badge ? (
                        <span
                          className={twMerge(
                            `px-2 py-px uppercase font-black rounded-md text-[.65rem]`,
                            'border-2 bg-transparent',
                            library.textStyle,
                            library.borderStyle,
                          )}
                        >
                          {library.badge}
                        </span>
                      ) : null}
                    </Link>
                  </MobileCard>
                  {/* Desktop: Simple link */}
                  <Link
                    to="/$libraryId/$version"
                    params={{ libraryId: library.id, version: 'latest' }}
                    className={twMerge(
                      linkClasses,
                      'hidden md:flex',
                      isActive ? 'bg-gray-500/10 dark:bg-gray-500/30' : '',
                    )}
                  >
                    <span
                      className={twMerge('w-3 h-3 rounded-sm', library.bgStyle)}
                    />
                    <span
                      style={{
                        viewTransitionName: `library-name-${library.id}`,
                      }}
                      className={twMerge(
                        'flex-1 text-left',
                        isActive ? 'font-bold' : '',
                      )}
                    >
                      {name}
                    </span>
                    {library.badge ? (
                      <span
                        className={twMerge(
                          `px-2 py-px uppercase font-black rounded-md text-[.6rem]`,
                          'border bg-transparent',
                          'border-current text-current',
                          'opacity-90 group-hover:opacity-100 transition-opacity',
                          library.textColor,
                        )}
                      >
                        {library.badge}
                      </span>
                    ) : null}
                  </Link>
                </>
              )}
            </div>
          )
        })}
        {/* Mobile: More Libraries card */}
        <MobileCard>
          <Link
            to="/libraries"
            className={twMerge(linkClasses, 'font-normal md:hidden')}
            activeProps={{
              className: twMerge(
                'font-bold! bg-gray-500/10 dark:bg-gray-500/30',
              ),
            }}
          >
            <div className="flex items-center gap-2">
              <Grid2X2 className="w-5 h-5 md:w-4 md:h-4" />
              <div>More Libraries</div>
            </div>
          </Link>
        </MobileCard>
        {/* Desktop: More Libraries link */}
        <Link
          to="/libraries"
          className={twMerge(linkClasses, 'font-normal hidden md:flex')}
          activeProps={{
            className: twMerge('font-bold! bg-gray-500/10 dark:bg-gray-500/30'),
          }}
        >
          <div className="flex items-center gap-2">
            <Grid2X2 className="w-4 h-4" />
            <div>More Libraries</div>
          </div>
        </Link>
        <div className="py-2 hidden md:block col-span-2">
          <div className="bg-gray-500/10 h-px" />
        </div>
      </div>
      {/* Mobile separator */}
      <div className="col-span-2 sm:col-span-3 py-3 md:hidden">
        <div className="bg-gray-500/10 h-px" />
      </div>
      <div className="contents md:block">
        {/* Mobile: Builder card */}
        <MobileCard>
          <Link
            to="/builder"
            className={twMerge(linkClasses, 'font-normal md:hidden')}
            activeProps={{
              className: twMerge(
                'font-bold! bg-gray-500/10 dark:bg-gray-500/30',
              ),
            }}
          >
            <div className="flex items-center gap-2 w-full">
              <Hammer className="w-5 h-5" />
              <div className="flex items-center justify-between flex-1 gap-2">
                <span>Builder</span>
                <span className="px-1.5 py-0.5 text-[.6rem] font-black border border-amber-500 text-amber-500 rounded-md uppercase">
                  Alpha
                </span>
              </div>
            </div>
          </Link>
        </MobileCard>
        {/* Desktop: Builder link */}
        <Link
          to="/builder"
          className={twMerge(linkClasses, 'font-normal hidden md:flex')}
          activeProps={{
            className: twMerge('font-bold! bg-gray-500/10 dark:bg-gray-500/30'),
          }}
        >
          <div className="flex items-center gap-2 w-full">
            <Hammer className="w-4 h-4" />
            <div className="flex items-center justify-between flex-1 gap-2">
              <span>Builder</span>
              <span className="px-1.5 py-0.5 text-[.6rem] font-black border border-amber-500 text-amber-500 rounded-md uppercase">
                Alpha
              </span>
            </div>
          </div>
        </Link>
        {[
          {
            label: (
              <>
                <span>Feed</span>
                <span className="px-1.5 py-0.5 text-[.6rem] font-black border border-blue-500 text-blue-500 rounded-md uppercase">
                  Beta
                </span>
              </>
            ),
            icon: Rss,
            to: '/feed',
          },
          {
            label: 'Maintainers',
            icon: Code,
            to: '/maintainers',
          },
          {
            label: 'Partners',
            icon: Users,
            to: '/partners',
          },
          {
            label: 'Showcase',
            icon: Sparkles,
            to: '/showcase',
          },
          {
            label: 'Blog',
            icon: Music,
            to: '/blog',
          },
          {
            label: (
              <>
                <span>Learn</span>
                <span className="px-1.5 py-0.5 text-[.6rem] font-black border border-green-500 text-green-500 rounded-md uppercase">
                  NEW
                </span>
              </>
            ),
            icon: BookOpen,
            to: '/learn',
          },
          {
            label: 'Support',
            icon: HelpCircle,
            to: '/support',
          },
          {
            label: 'Stats',
            icon: TrendingUp,
            to: '/stats/npm',
          },
          {
            label: 'Discord',
            icon: DiscordIcon,
            to: 'https://tlinz.com/discord',
            target: '_blank',
          },
          {
            label: 'Merch',
            icon: Shirt,
            to: '/merch',
          },
          {
            label: 'GitHub',
            icon: GithubIcon,
            to: 'https://github.com/tanstack',
          },
          {
            label: 'Ethos',
            icon: ShieldCheck,
            to: '/ethos',
          },
          {
            label: 'Tenets',
            icon: BookOpen,
            to: '/tenets',
          },
          {
            label: 'Brand Guide',
            icon: Paintbrush,
            to: '/brand-guide',
          },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <React.Fragment key={i}>
              {/* Mobile: Card */}
              <MobileCard>
                <Link
                  to={item.to}
                  className={twMerge(linkClasses, 'font-normal md:hidden')}
                  activeProps={{
                    className: twMerge(
                      'font-bold! bg-gray-500/10 dark:bg-gray-500/30',
                    ),
                  }}
                  target={item.to.startsWith('http') ? '_blank' : undefined}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="w-5 h-5" />
                    <div className="flex items-center justify-between flex-1 gap-2">
                      {item.label}
                    </div>
                  </div>
                </Link>
              </MobileCard>
              {/* Desktop: Link */}
              <Link
                to={item.to}
                className={twMerge(linkClasses, 'font-normal hidden md:flex')}
                activeProps={{
                  className: twMerge(
                    'font-bold! bg-gray-500/10 dark:bg-gray-500/30',
                  ),
                }}
                target={item.to.startsWith('http') ? '_blank' : undefined}
              >
                <div className="flex items-center gap-2 w-full">
                  <Icon className="w-4 h-4" />
                  <div className="flex items-center justify-between flex-1 gap-2">
                    {item.label}
                  </div>
                </div>
              </Link>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )

  const smallMenu = showMenu ? (
    <div
      ref={smallMenuRef}
      className="md:hidden bg-white/50 dark:bg-black/60 backdrop-blur-[20px] z-50
    fixed top-[var(--navbar-height)] left-0 right-0 max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto
    "
    >
      <div
        className="flex flex-col whitespace-nowrap overflow-y-auto
          border-t border-gray-500/20 text-lg bg-white/80 dark:bg-black/90"
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
        <div
          onClick={(event) => {
            const target = event.target as HTMLElement
            if (target.closest('[data-collapsible-trigger]')) {
              return
            }
            if (target.closest('a') || target.closest('button')) {
              setShowMenu(false)
            }
          }}
        >
          <div className="px-3 pt-3 sm:hidden">
            <SearchButton className="w-full py-3 text-base [&_svg]:w-5 [&_svg]:h-5" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-base p-3 border-b border-gray-500/20">
            {items}
          </div>
          <div className="p-4 sm:hidden">{socialLinks}</div>
        </div>
      </div>
    </div>
  ) : null

  const inlineMenu = !Title

  const leaveTimer = React.useRef<NodeJS.Timeout | undefined>(undefined)

  const largeMenu = (
    <>
      <div
        ref={largeMenuRef}
        className={twMerge(
          `hidden md:flex flex-col
      h-[calc(100dvh-var(--navbar-height))] z-20
      bg-white/50 dark:bg-black/30 border-r border-gray-500/20`,
          'transition-all duration-300',
          'z-50',
          // md breakpoint: always flyout
          'md:fixed md:top-[var(--navbar-height)] md:bg-white md:dark:bg-black/90 md:backdrop-blur-lg md:shadow-xl',
          !showMenu && 'md:-translate-x-full',
          showMenu && 'md:translate-x-0',
          // lg breakpoint: inline when no Title, flyout when Title
          inlineMenu &&
            'lg:sticky lg:top-[var(--navbar-height)] lg:translate-x-0 lg:bg-white/50 lg:dark:bg-black/30 lg:backdrop-blur-none lg:shadow-none',
          !inlineMenu &&
            'lg:fixed lg:top-[var(--navbar-height)] lg:bg-white lg:dark:bg-black/90 lg:backdrop-blur-lg lg:shadow-xl',
          !inlineMenu && !showMenu && 'lg:-translate-x-full',
          !inlineMenu && showMenu && 'lg:translate-x-0',
        )}
        onPointerEnter={(e) => {
          if (e.pointerType === 'touch') return
          clearTimeout(leaveTimer.current)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'touch') return
          leaveTimer.current = setTimeout(() => {
            setShowMenu(false)
          }, 300)
        }}
      >
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[50px] min-w-[220px]">
          <div className="flex flex-col gap-1 text-sm p-2">{items}</div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {navbar}
      {/* Sticky announcement banners below the nav */}
      <div className="sticky top-[var(--navbar-height)] z-[99]">
        <React.Suspense fallback={null}>
          <LazyAnnouncementBanner />
        </React.Suspense>
      </div>
      <div
        className={twMerge(
          `min-h-[calc(100dvh-var(--navbar-height))] flex flex-col
          min-w-0 md:flex-row w-full transition-all duration-300
          pt-[var(--navbar-height)]`,
        )}
      >
        {smallMenu}
        {largeMenu}
        <div className="flex-1 min-w-0 flex flex-col w-full min-h-0">
          {children}
        </div>
      </div>
    </>
  )
}
