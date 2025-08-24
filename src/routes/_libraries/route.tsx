import * as React from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { CgClose, CgMenuLeft, CgMusicSpeaker } from 'react-icons/cg'
import { MdLibraryBooks, MdLineAxis, MdSupport } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'
import { sortBy } from '~/utils/utils'
import logoColor100w from '~/images/logo-color-100w.png'
import {
  FaCode,
  FaDiscord,
  FaGithub,
  FaInstagram,
  FaLock,
  FaSignInAlt,
  FaTshirt,
  FaUser,
  FaUsers,
} from 'react-icons/fa'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import { libraries } from '~/libraries'
import { Scarf } from '~/components/Scarf'
import { ThemeToggle } from '~/components/ThemeToggle'
import { TbBrandBluesky, TbBrandX } from 'react-icons/tb'
import { BiSolidCheckShield } from 'react-icons/bi'
import { SearchButton } from '~/components/SearchButton'
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from 'convex/react'
import { api } from 'convex/_generated/api'
import { PiHammerFill } from 'react-icons/pi'

export const Route = createFileRoute({
  staleTime: Infinity,
  loader: async (ctx) => {
    return {
      sponsorsPromise: getSponsorsForSponsorPack(),
    }
  },
  component: () => {
    return (
      <LibrariesLayout>
        <Outlet />
      </LibrariesLayout>
    )
  },
})

export function LibrariesLayout({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.auth.getCurrentUser)

  const activeLibrary = useLocation({
    select: (location) => {
      return libraries.find((library) => {
        return location.pathname.startsWith(library.to!)
      })
    },
  })

  const detailsRef = React.useRef<HTMLElement>(null!)
  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const canAdmin = user?.capabilities.includes('admin')

  const items = (
    <>
      {sortBy(
        libraries.filter((d) => d.to),
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
                <Link
                  to={library.to}
                  onClick={() => {
                    detailsRef.current.removeAttribute('open')
                  }}
                >
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
                              props.isActive ? `font-bold dark:opacity-100` : ''
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
                              `px-2 py-px uppercase font-black bg-gray-500/10 dark:bg-gray-500/20 rounded-full text-[.7rem] group-hover:opacity-100 transition-opacity text-white animate-pulse`,
                              // library.badge === 'new'
                              //   ? 'text-green-500'
                              //   : library.badge === 'soon'
                              //   ? 'text-cyan-500'
                              //   : '',
                              library.textStyle
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
      <div className="py-2">
        <div className="bg-gray-500/10 h-px" />
      </div>
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
      ].map((item, i) => {
        return (
          <Link
            to={item.to}
            onClick={() => detailsRef.current.removeAttribute('open')}
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

      <div className="py-2">
        <div className="bg-gray-500/10 h-px" />
      </div>

      {(() => {
        const loginEl = (
          <Link
            to="/login"
            className={twMerge(linkClasses, 'font-normal')}
            activeProps={{
              className: twMerge(
                'font-bold! bg-gray-500/10 dark:bg-gray-500/30'
              ),
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4 justify-between">
                <FaSignInAlt />
              </div>
              <div>Login</div>
            </div>
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
            className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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

  const logo = (
    <div className="flex-1 flex items-center gap-4 justify-between">
      <Link to="/" className={twMerge(`flex items-center gap-1.5`)}>
        <img
          src={logoColor100w}
          alt=""
          className="w-[30px] rounded-full overflow-hidden border-2 border-black dark:border-none"
        />
        <div className="font-black text-xl uppercase">TanStack</div>
      </Link>
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
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </div>
  )

  const smallMenu = (
    <div className="lg:hidden bg-white/50 dark:bg-black/60 sticky top-0 z-20 backdrop-blur-[20px]">
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
        <div
          className="flex flex-col gap-4 whitespace-nowrap overflow-y-auto
          border-t border-gray-500/20 text-lg bg-white/80 dark:bg-black/20"
        >
          <div className="p-2 pb-0">
            <SearchButton />
          </div>
          <div className="space-y-px text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
            {items}
          </div>
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <>
      <div className="min-w-[250px] hidden lg:flex flex-col h-screen sticky top-0 z-20 bg-white/50 dark:bg-black/30 shadow-xl dark:border-r border-gray-500/20">
        <div className="p-4 flex gap-2 items-center text-2xl border-b border-gray-500/10 dark:border-gray-500/20">
          {logo}
        </div>
        <div className="p-2">
          <SearchButton />
        </div>
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[50px]">
          <div className="flex flex-col gap-1 text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
            {items}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div
      className={`min-h-screen flex flex-col min-w-0 lg:flex-row w-full transition-all duration-300`}
    >
      {smallMenu}
      {largeMenu}
      <div className="flex flex-1 min-h-0 relative justify-center overflow-x-hidden">
        {children}
      </div>
      {activeLibrary?.scarfId ? <Scarf id={activeLibrary.scarfId} /> : null}
    </div>
  )
}
