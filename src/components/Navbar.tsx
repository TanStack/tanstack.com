import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { BrandContextMenu } from './BrandContextMenu'
import { Link, useLocation, useMatches } from '@tanstack/react-router'
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
  Lock,
  Menu,
  Rss,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { SearchButton } from './SearchButton'
import { FeedTicker } from './FeedTicker'
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from '~/components/AuthComponents'
import { libraries, findLibrary } from '~/libraries'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useClickOutside } from '~/hooks/useClickOutside'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { DiscordIcon } from '~/components/icons/DiscordIcon'
import { InstagramIcon } from '~/components/icons/InstagramIcon'
import { BSkyIcon } from '~/components/icons/BSkyIcon'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { AnnouncementBanner } from '~/components/AnnouncementBanner'

export function Navbar({ children }: { children: React.ReactNode }) {
  const matches = useMatches()
  const capabilities = useCapabilities()

  const { Title, library } = React.useMemo(() => {
    const match = [...matches].reverse().find((m) => m.staticData.Title)
    const libraryId = match?.params?.libraryId

    return {
      Title: match?.staticData.Title ?? null,
      library: libraryId ? findLibrary(libraryId) : null,
    }
  }, [matches])

  const canAdmin = capabilities.includes('admin')

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

  const toggleMenu = () => {
    setShowMenu((prev) => !prev)
  }

  // Close mobile menu when clicking outside
  const smallMenuRef = useClickOutside<HTMLDivElement>({
    enabled: showMenu,
    onClickOutside: () => setShowMenu(false),
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
        {!canAdmin ? (
          <Link
            to="/account"
            className="flex items-center gap-1 rounded-md px-2 py-1.5
            border border-gray-200 dark:border-gray-700
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors duration-200 text-xs font-medium"
          >
            <User className="w-3.5 h-3.5" />
            <span>Account</span>
          </Link>
        ) : null}
        {canAdmin ? (
          <Link
            to="/admin"
            className="flex items-center gap-1 rounded-md px-2 py-1.5
            bg-black dark:bg-white text-white dark:text-black
            hover:bg-gray-800 dark:hover:bg-gray-200
            transition-colors duration-200 text-xs font-medium"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        ) : null}
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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-black text-xl uppercase">
          <BrandContextMenu
            className={twMerge(`flex items-center gap-1.5 group`)}
          >
            <button
              aria-label="Open Menu"
              className={twMerge(
                'flex items-center justify-center',
                'transition-all duration-300 h-8 px-2 py-1 lg:px-0',
                Title
                  ? 'lg:w-9 lg:opacity-100 lg:translate-x-0'
                  : 'lg:w-0 lg:opacity-0 lg:-translate-x-full',
              )}
              onClick={toggleMenu}
              onPointerEnter={() => {
                if (window.innerWidth < 1024) {
                  return
                }
                setShowMenu(true)
              }}
            >
              <Menu />
            </button>
            <Link
              to="/"
              className={twMerge(
                `inline-flex items-center gap-1.5 cursor-pointer`,
              )}
            >
              <div className="w-[30px] inline-grid items-center grid-cols-1 grid-rows-1 [&>*]:transition-opacity [&>*]:duration-1000">
                <img
                  src={'/images/logos/logo-color-100.png'}
                  alt=""
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
          </BrandContextMenu>
          {Title ? <Title /> : null}
        </div>
      </div>
      <div className="hidden xl:flex flex-1 justify-end min-w-0">
        <FeedTicker />
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden min-[750px]:block">{socialLinks}</div>
        <div className="hidden sm:block">
          <SearchButton />
        </div>
        <ThemeToggle />
        <div className="hidden xs:flex items-center gap-2">{loginButton}</div>
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

  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const items = (
    <div className="md:flex gap-2 [&>*]:flex-1 lg:block">
      <div>
        {(() => {
          const sidebarLibraryIds = [
            'start',
            'router',
            'query',
            'table',
            'db',
            'ai',
            'form',
            'virtual',
            'pacer',
            'store',
            'devtools',
          ]
          return libraries
            .filter(
              (
                d,
              ): d is Library & {
                to: string
                textStyle: string
                badge?: string
                colorFrom: string
              } => d.to !== undefined && sidebarLibraryIds.includes(d.id),
            )
            .sort((a, b) => {
              const indexA = sidebarLibraryIds.indexOf(a.id)
              const indexB = sidebarLibraryIds.indexOf(b.id)
              return indexA - indexB
            })
        })().map((library, i) => {
          const [prefix, name] = library.name.split(' ')

          return (
            <div key={i}>
              {library.to?.startsWith('http') ? (
                <a href={library.to} className={linkClasses}>
                  <span>
                    <span className="font-light dark:font-bold dark:opacity-40">
                      {prefix}
                    </span>{' '}
                    <span className={library.textStyle}>{name}</span>
                  </span>
                </a>
              ) : (
                <div>
                  <Link to={library.to}>
                    {(props: { isActive: boolean }) => {
                      return (
                        <div
                          className={twMerge(
                            linkClasses,
                            props.isActive
                              ? 'bg-gray-500/10 dark:bg-gray-500/30'
                              : '',
                          )}
                        >
                          <span
                            style={{
                              viewTransitionName: `library-name-${library.id}`,
                            }}
                          >
                            <span
                              className={twMerge(
                                'font-light dark:font-bold dark:opacity-40',
                                props.isActive
                                  ? `font-bold dark:opacity-100`
                                  : '',
                              )}
                            >
                              {prefix}
                            </span>{' '}
                            <span
                              className={twMerge(
                                library.textStyle,
                                // isPending &&
                                //   `[view-transition-name:library-name]`
                              )}
                            >
                              {name}
                            </span>
                          </span>
                          {library.badge ? (
                            <span
                              className={twMerge(
                                `px-2 py-px uppercase font-black bg-gray-500/10 dark:bg-gray-500/30 rounded-md text-[.7rem] text-white`,
                                'opacity-50 group-hover:opacity-100 transition-opacity',
                                'bg-gradient-to-r',
                                library.colorFrom,
                                library.colorTo,
                                'text-[.6rem]',
                              )}
                            >
                              {library.badge}
                            </span>
                          ) : null}
                        </div>
                      )
                    }}
                  </Link>
                  <div
                    className={twMerge(
                      library.to === activeLibrary?.to ? 'block' : 'hidden',
                    )}
                  >
                    {library.menu?.map((item, i) => {
                      return (
                        <Link
                          to={item.to}
                          key={i}
                          className={twMerge(
                            'flex gap-2 items-center px-2 ml-2 my-1 py-0.5',
                            'rounded-lg hover:bg-gray-500/10 dark:hover:bg-gray-500/30',
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      )
                    })}
                    <Link
                      to={`/$libraryId/$version/docs/contributors`}
                      params={{
                        libraryId: library.id,
                        version: 'latest',
                      }}
                      className={twMerge(
                        'flex gap-2 items-center px-2 ml-2 my-1 py-0.5',
                        'rounded-lg hover:bg-gray-500/10 dark:hover:bg-gray-500/30',
                      )}
                    >
                      <Users />
                      Contributors
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <Link
          to="/libraries"
          className={twMerge(linkClasses, 'font-normal')}
          activeProps={{
            className: twMerge('font-bold! bg-gray-500/10 dark:bg-gray-500/30'),
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 justify-between">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <div>More Libraries</div>
          </div>
        </Link>
        <div className="py-2">
          <div className="bg-gray-500/10 h-px" />
        </div>
      </div>
      <div>
        <Authenticated>
          {capabilities.some((capability) =>
            (['builder', 'admin'] as const).includes(
              capability as 'builder' | 'admin',
            ),
          ) ? (
            <Link
              to="/builder"
              className={twMerge(linkClasses, 'font-normal')}
              activeProps={{
                className: twMerge(
                  'font-bold! bg-gray-500/10 dark:bg-gray-500/30',
                ),
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-4 justify-between">
                  <Hammer />
                </div>
                <div>Builder</div>
              </div>
            </Link>
          ) : null}
        </Authenticated>
        {[
          {
            label: (
              <>
                <span>Feed</span>
                <span className="px-1.5 py-0.5 text-[.6rem] font-black bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-md uppercase">
                  Beta
                </span>
              </>
            ),
            icon: <Rss />,
            to: '/feed',
          },
          {
            label: 'Maintainers',
            icon: <Code />,
            to: '/maintainers',
          },
          {
            label: 'Partners',
            icon: <Users />,
            to: '/partners',
          },
          {
            label: 'Blog',
            icon: <Music />,
            to: '/blog',
          },
          {
            label: (
              <>
                <span>Learn</span>
                <span className="px-1.5 py-0.5 text-[.6rem] font-black bg-gradient-to-r from-green-400 to-green-600 text-white rounded-md uppercase">
                  NEW
                </span>
              </>
            ),
            icon: <BookOpen />,
            to: '/learn',
          },
          {
            label: 'Support',
            icon: <HelpCircle />,
            to: '/support',
          },
          {
            label: 'Stats',
            icon: <TrendingUp />,
            to: '/stats/npm',
          },
          {
            label: 'Discord',
            icon: <DiscordIcon />,
            to: 'https://tlinz.com/discord',
            target: '_blank',
          },
          {
            label: 'Merch',
            icon: <Shirt />,
            to: '/merch',
          },
          {
            label: 'GitHub',
            icon: <GithubIcon />,
            to: 'https://github.com/tanstack',
          },
          {
            label: 'Ethos',
            icon: <ShieldCheck />,
            to: '/ethos',
          },
          {
            label: 'Tenets',
            icon: <BookOpen />,
            to: '/tenets',
          },
          {
            label: 'Brand Guide',
            icon: <Paintbrush />,
            to: '/brand-guide',
          },
        ]
          .filter((item) => {
            // Filter out items that require capabilities the user doesn't have
            if (item.requiresCapability) {
              return (
                capabilities.includes(item.requiresCapability) ||
                capabilities.includes('admin')
              )
            }
            return true
          })
          .map((item, i) => {
            return (
              <Link
                to={item.to}
                key={i}
                className={twMerge(linkClasses, 'font-normal')}
                activeProps={{
                  className: twMerge(
                    'font-bold! bg-gray-500/10 dark:bg-gray-500/30',
                  ),
                }}
                target={item.to.startsWith('http') ? '_blank' : undefined}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="flex items-center gap-4 justify-between">
                    {item.icon}
                  </div>
                  <div className="flex items-center justify-between flex-1 gap-2">
                    {typeof item.label === 'string' ? item.label : item.label}
                  </div>
                </div>
              </Link>
            )
          })}
      </div>
    </div>
  )

  const smallMenu = showMenu ? (
    <div
      ref={smallMenuRef}
      className="lg:hidden bg-white/50 dark:bg-black/60 backdrop-blur-[20px] z-50
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
            if (target.closest('a') || target.closest('button')) {
              setShowMenu(false)
            }
          }}
        >
          <div className="flex items-center justify-between p-2 gap-2">
            <div className="flex-1">
              <SearchButton />
            </div>
            <div className="xs:hidden">{loginButton}</div>
          </div>
          <div className="space-y-px text-sm p-2 border-b border-gray-500/20">
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
        className={twMerge(
          `px] hidden lg:flex flex-col
      h-[calc(100dvh-var(--navbar-height))] sticky top-[var(--navbar-height)] z-20
      bg-white/50 dark:bg-black/30 border-r border-gray-500/20`,
          'transition-all duration-300',
          'z-50',
          !inlineMenu &&
            'fixed bg-white dark:bg-black/90 backdrop-blur-lg shadow-xl',
          !inlineMenu && !showMenu && '-translate-x-full',
          !inlineMenu && showMenu && 'translate-x-0',
        )}
        onPointerEnter={() => {
          clearTimeout(leaveTimer.current)
        }}
        onPointerLeave={() => {
          leaveTimer.current = setTimeout(() => {
            setShowMenu(false)
          }, 300)
        }}
      >
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[50px] min-w-[260px]">
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
        <AnnouncementBanner />
      </div>
      <div
        className={twMerge(
          `min-h-[calc(100dvh-var(--navbar-height))] flex flex-col
          min-w-0 lg:flex-row w-full transition-all duration-300
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
