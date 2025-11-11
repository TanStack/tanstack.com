import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { BrandContextMenu } from './BrandContextMenu'
import { Link, useLocation, useMatches } from '@tanstack/react-router'
import { TbBrandX, TbBrandBluesky } from 'react-icons/tb'
import {
  FaCode,
  FaDiscord,
  FaGithub,
  FaInstagram,
  FaLock,
  FaPaintRoller,
  FaTshirt,
  FaUser,
  FaUsers,
} from 'react-icons/fa'
import { ThemeToggle } from './ThemeToggle'
import { SearchButton } from './SearchButton'
import { Authenticated, Unauthenticated, useQuery } from 'convex/react'
import { AuthLoading } from 'convex/react'
import { api } from 'convex/_generated/api'
import { MdLibraryBooks, MdLineAxis, MdPerson, MdSupport } from 'react-icons/md'
import { CgClose, CgMenuLeft, CgMusicSpeaker } from 'react-icons/cg'
import { BiSolidCheckShield } from 'react-icons/bi'
import { PiHammerFill } from 'react-icons/pi'
import { libraries } from '~/libraries'
import { sortBy } from '~/utils/utils'

export function Navbar({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.auth.getCurrentUser)
  const matches = useMatches()

  const Title =
    [...matches].reverse().find((m) => m.staticData.Title)?.staticData.Title ??
    null

  const canAdmin = user?.capabilities.includes('admin')

  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.offsetHeight
        document.documentElement.style.setProperty(
          '--navbar-height',
          `${height}px`
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

  const loginButton = (
    <>
      {(() => {
        const loginEl = (
          <Link
            to="/login"
            className="flex items-center gap-1 bg-gray-500/20 rounded-lg p-2 opacity-80
            hover:opacity-100 whitespace-nowrap uppercase font-black text-xs"
          >
            <MdPerson className="scale-125" />
            <div className="">Log In</div>
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
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
          <FaUser />
          <Link
            to="/account"
            className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white whitespace-nowrap"
          >
            My Account
          </Link>
        </div>
        {canAdmin ? (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
            <FaLock />
            <Link
              to="/admin"
              className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Admin
            </Link>
          </div>
        ) : null}
      </Authenticated>
    </>
  )

  const socialLinks = (
    <div className="flex items-center gap-1">
      <a
        href="https://x.com/tan_stack"
        className="opacity-70 hover:opacity-100"
        aria-label="Follow TanStack on X.com"
      >
        <TbBrandX className="text-xl" />
      </a>
      <a
        href="https://bsky.app/profile/tanstack.com"
        className="opacity-70 hover:opacity-100"
        aria-label="Follow TanStack on Bluesky"
      >
        <TbBrandBluesky className="text-xl" />
      </a>
      <a
        href="https://instagram.com/tan_stack"
        className="opacity-70 hover:opacity-100"
        aria-label="Follow TanStack on Instagram"
      >
        <FaInstagram className="text-xl" />
      </a>
    </div>
  )

  const navbar = (
    <div
      className={twMerge(
        'w-full p-2 fixed top-0 z-[100] bg-white/70 dark:bg-black/70 backdrop-blur-lg shadow-xl shadow-black/3',
        'flex items-center justify-between gap-4',
        'dark:border-b border-gray-500/20'
      )}
      ref={containerRef}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-black text-xl uppercase">
          <BrandContextMenu
            className={twMerge(`flex items-center gap-1.5 group`)}
          >
            <button
              className={twMerge(
                'flex items-center justify-center',
                'transition-all duration-300 h-8 px-2 py-1 lg:px-0',
                Title
                  ? 'lg:w-9 lg:opacity-100 lg:translate-x-0'
                  : 'lg:w-0 lg:opacity-0 lg:-translate-x-full'
              )}
              onClick={toggleMenu}
              onPointerEnter={() => {
                if (window.innerWidth < 1024) {
                  return
                }
                setShowMenu(true)
              }}
            >
              {showMenu ? <CgClose /> : <CgMenuLeft />}
            </button>
            <Link
              to="/"
              className={twMerge(
                `inline-flex items-center gap-1.5 cursor-pointer`
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
        <div className="flex-1 max-w-[180px] font-normal hidden lg:block">
          <SearchButton />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:block">{socialLinks}</div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {loginButton}
        </div>
      </div>
    </div>
  )

  const activeLibrary = useLocation({
    select: (location) => {
      return libraries.find((library) => {
        return location.pathname.startsWith(library.to!)
      })
    },
  })

  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const items = (
    <div className="md:flex gap-2 [&>*]:flex-1 lg:block">
      <div>
        {sortBy(
          libraries.filter((d) => {
            const sidebarLibraryIds = [
              'start',
              'router',
              'query',
              'table',
              'form',
              'db',
              'virtual',
              'pacer',
              'store',
              'devtools',
            ]
            return d.to && sidebarLibraryIds.includes(d.id)
          }),
          (d) => !d.name.includes('TanStack')
        ).map((library, i) => {
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
                    {(props) => {
                      return (
                        <div
                          className={twMerge(
                            linkClasses,
                            props.isActive
                              ? 'bg-gray-500/10 dark:bg-gray-500/30'
                              : ''
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
                                  : ''
                              )}
                            >
                              {prefix}
                            </span>{' '}
                            <span
                              className={twMerge(
                                library.textStyle
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
                                'text-[.6rem]'
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
                      library.to === activeLibrary?.to ? 'block' : 'hidden'
                    )}
                  >
                    {library.menu?.map((item, i) => {
                      return (
                        <Link
                          to={item.to}
                          key={i}
                          className={twMerge(
                            'flex gap-2 items-center px-2 ml-2 my-1 py-0.5',
                            'rounded-lg hover:bg-gray-500/10 dark:hover:bg-gray-500/30'
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
                        'rounded-lg hover:bg-gray-500/10 dark:hover:bg-gray-500/30'
                      )}
                    >
                      <FaUsers />
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
          {user?.capabilities.some((capability) =>
            ['builder', 'admin'].includes(capability)
          ) ? (
            <Link
              to="/builder"
              className={twMerge(linkClasses, 'font-normal')}
              activeProps={{
                className: twMerge(
                  'font-bold! bg-gray-500/10 dark:bg-gray-500/30'
                ),
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-4 justify-between">
                  <PiHammerFill />
                </div>
                <div>Builder</div>
              </div>
            </Link>
          ) : null}
        </Authenticated>
        {[
          {
            label: 'Maintainers',
            icon: <FaCode />,
            to: '/maintainers',
          },
          {
            label: 'Partners',
            icon: <FaUsers />,
            to: '/partners',
          },
          {
            label: 'Support',
            icon: <MdSupport />,
            to: '/support',
          },
          {
            label: 'Learn',
            icon: <MdLibraryBooks />,
            to: '/learn',
          },
          {
            label: (
              <span className="flex items-center gap-2">
                Stats
                <span className="text-xs bg-transparent text-transparent bg-clip-text bg-linear-to-r border border-cyan-600 from-blue-500 to-cyan-500 font-bold px-1 rounded">
                  BETA
                </span>
              </span>
            ),
            icon: <MdLineAxis />,
            to: '/stats/npm',
          },
          {
            label: 'Discord',
            icon: <FaDiscord />,
            to: 'https://tlinz.com/discord',
            target: '_blank',
          },
          {
            label: 'Merch',
            icon: <FaTshirt />,
            to: 'https://cottonbureau.com/people/tanstack',
          },
          {
            label: 'Blog',
            icon: <CgMusicSpeaker />,
            to: '/blog',
          },
          {
            label: 'GitHub',
            icon: <FaGithub />,
            to: 'https://github.com/tanstack',
          },
          {
            label: 'Ethos',
            icon: <BiSolidCheckShield />,
            to: '/ethos',
          },
          {
            label: 'Brand Guide',
            icon: <FaPaintRoller />,
            to: '/brand-guide',
          },
        ].map((item, i) => {
          return (
            <Link
              to={item.to}
              key={i}
              className={twMerge(linkClasses, 'font-normal')}
              activeProps={{
                className: twMerge(
                  'font-bold! bg-gray-500/10 dark:bg-gray-500/30'
                ),
              }}
              target={item.to.startsWith('http') ? '_blank' : undefined}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-4 justify-between">
                  {item.icon}
                </div>
                <div>{item.label}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )

  const smallMenu = showMenu ? (
    <div
      className="lg:hidden bg-white/50 dark:bg-black/60 backdrop-blur-[20px] z-50
    fixed top-[var(--navbar-height)] left-0 right-0 max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto
    "
    >
      <div
        className="flex flex-col whitespace-nowrap overflow-y-auto
          border-t border-gray-500/20 text-lg bg-white/80 dark:bg-black/20"
      >
        <div className="flex items-center justify-between p-2 gap-2">
          <div className="flex-1">
            <SearchButton />
          </div>
          <div className="sm:hidden">{loginButton}</div>
        </div>
        <div
          className="space-y-px text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20"
          onClick={(event) => {
            const target = event.target as HTMLElement
            if (target.closest('a')) {
              setShowMenu(false)
            }
          }}
        >
          {items}
        </div>
        <div className="p-4 sm:hidden">{socialLinks}</div>
      </div>
    </div>
  ) : null

  const inlineMenu = !Title

  const leaveTimer = React.useRef<NodeJS.Timeout | undefined>(undefined)

  const largeMenu = (
    <>
      <div
        className={twMerge(
          `min-w-[250px] hidden lg:flex flex-col
      h-[calc(100dvh-var(--navbar-height))] sticky top-[var(--navbar-height)] z-20
      bg-white/50 dark:bg-black/30 shadow-xl dark:border-r border-gray-500/20`,
          'transition-all duration-300',
          'z-50',
          inlineMenu
            ? ''
            : [
                'fixed bg-white/70 dark:bg-black/50 backdrop-blur-lg -translate-x-full',
                showMenu && 'translate-x-0',
              ]
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
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[50px]">
          <div className="flex flex-col gap-1 text-sm p-2">{items}</div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {navbar}
      <div
        className={twMerge(
          `min-h-[calc(100dvh-var(--navbar-height))] flex flex-col
          min-w-0 lg:flex-row w-full transition-all duration-300
          pt-[var(--navbar-height)]`
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
