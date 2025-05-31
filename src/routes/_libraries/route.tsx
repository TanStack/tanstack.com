import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { SearchButton } from '~/components/SearchButton'
import { ThemeToggle, useThemeStore } from '~/components/ThemeToggle'
import logoColor100w from '~/images/logo-color-100w.png'
import { libraries } from '~/libraries'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import { sortBy } from '~/utils/utils'
import * as React from 'react'
import { BiSolidCheckShield } from 'react-icons/bi'
import { CgClose, CgMenuLeft, CgMusicSpeaker } from 'react-icons/cg'
import { FaDiscord, FaGithub, FaInstagram, FaTshirt } from 'react-icons/fa'
import { MdLibraryBooks, MdLineAxis, MdSupport } from 'react-icons/md'
import { TbBrandBluesky, TbBrandTwitter } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute({
  staleTime: Infinity,
  loader: async (ctx) => {
    return {
      sponsorsPromise: getSponsorsForSponsorPack(),
    }
  },
  component: LibrariesLayout,
})

function LibrariesLayout() {
  const activeLibrary = useLocation({
    select: (location) => {
      return libraries.find((library) => {
        return location.pathname.startsWith(library.to)
      })
    },
  })

  const detailsRef = React.useRef<HTMLElement>(null!)
  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const items = (
    <>
      {sortBy(libraries, (d) => !d.name.includes('TanStack')).map(
        (library, i) => {
          const [prefix, name] = library.name.split(' ')

          return (
            <div key={i}>
              {library.to.startsWith('http') ? (
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
                                `animate-pulse rounded-full bg-gray-500/10 px-2 py-px text-[.7rem] font-black text-white uppercase transition-opacity group-hover:opacity-100 dark:bg-gray-500/20`,
                                // library.badge === 'new'
                                //   ? 'text-green-500'
                                //   : library.badge === 'soon'
                                //   ? 'text-cyan-500'
                                //   : '',
                                library.textStyle,
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
                            'my-1 ml-2 flex items-center gap-2 px-2 py-0.5',
                            'rounded-lg hover:bg-gray-500/10 dark:hover:bg-gray-500/30',
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        },
      )}
      <div className="py-2">
        <div className="h-px bg-gray-500/10" />
      </div>
      {[
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
              <span className="rounded border border-cyan-600 bg-transparent bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text px-1 text-xs font-bold text-transparent">
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
            key={i}
            className={twMerge(linkClasses, 'font-normal')}
            activeProps={{
              className: twMerge(
                '!font-bold bg-gray-500/10 dark:bg-gray-500/30',
              ),
            }}
            target={item.to.startsWith('http') ? '_blank' : undefined}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-between gap-4">
                {item.icon}
              </div>
              <div>{item.label}</div>
            </div>
          </Link>
        )
      })}
    </>
  )

  const logo = (
    <div className="flex flex-1 items-center justify-between gap-4">
      <Link to="/" className={twMerge(`flex items-center gap-1.5`)}>
        <img
          src={logoColor100w}
          alt=""
          className="w-[30px] overflow-hidden rounded-full border-2 border-black dark:border-none"
        />
        <div className="text-xl font-black uppercase">TanStack</div>
      </Link>
      <div className="flex items-center gap-1">
        <a
          href="https://x.com/tan_stack"
          className="opacity-70 hover:opacity-100"
        >
          <TbBrandTwitter className="text-xl" />
        </a>
        <a
          href="https://bsky.app/profile/tanstack.com"
          className="opacity-70 hover:opacity-100"
        >
          <TbBrandBluesky className="text-xl" />
        </a>
        <a
          href="https://instagram.com/tan_stack"
          className="opacity-70 hover:opacity-100"
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
    <div className="sticky top-0 z-20 bg-white/50 backdrop-blur-[20px] lg:hidden dark:bg-black/60">
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
        <div className="flex flex-col gap-4 overflow-y-auto border-t border-gray-500/20 bg-white/80 text-lg whitespace-nowrap dark:bg-black/20">
          <div className="p-2 pb-0">
            <SearchButton />
          </div>
          <div className="space-y-px border-b border-gray-500/10 p-2 text-sm dark:border-gray-500/20">
            {items}
          </div>
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <>
      <div className="sticky top-0 z-20 hidden h-screen min-w-[250px] flex-col border-gray-500/20 bg-white/50 shadow-xl lg:flex dark:border-r dark:bg-black/30">
        <div className="flex items-center gap-2 border-b border-gray-500/10 p-4 text-2xl dark:border-gray-500/20">
          {logo}
        </div>
        <div className="p-2">
          <SearchButton />
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-[50px] text-base whitespace-nowrap">
          <div className="space-y-1 border-b border-gray-500/10 p-2 text-sm dark:border-gray-500/20">
            {items}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div
      className={`flex min-h-screen w-full min-w-0 flex-col transition-all duration-300 lg:flex-row`}
    >
      {smallMenu}
      {largeMenu}
      <div className="relative flex min-h-0 flex-1 justify-center overflow-x-hidden">
        <Outlet />
      </div>
      {activeLibrary?.scarfId ? <Scarf id={activeLibrary.scarfId} /> : null}
    </div>
  )
}
