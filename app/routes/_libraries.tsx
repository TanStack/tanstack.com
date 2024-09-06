import * as React from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  defer,
  useParams,
} from '@tanstack/react-router'
import { CgClose, CgMenuLeft, CgMusicSpeaker } from 'react-icons/cg'
import { MdLibraryBooks, MdSupport } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'
import { OramaSearchBox } from '@orama/react-components'
import { sortBy } from '~/utils/utils'
import logoColor100w from '~/images/logo-color-100w.png'
import {
  FaDiscord,
  FaGithub,
  FaInstagram,
  FaTshirt,
  FaTwitter,
} from 'react-icons/fa'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import { getLibrary, libraries } from '~/libraries'
import { Scarf } from '~/components/Scarf'
import { searchBoxParams, searchButtonParams } from '~/components/Orama'
import { ClientOnlySearchButton } from '~/components/ClientOnlySearchButton'

export const Route = createFileRoute('/_libraries')({
  loader: async (ctx) => {
    return {
      sponsorsPromise: defer(getSponsorsForSponsorPack()),
    }
  },
  component: LibrariesLayout,
})

function LibrariesLayout() {
  const { libraryId } = useParams({
    strict: false,
    experimental_returnIntersection: true,
  })
  const library = libraryId ? getLibrary(libraryId) : undefined
  const detailsRef = React.useRef<HTMLElement>(null!)

  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500 hover:bg-opacity-10 font-black`

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

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
              )}
            </div>
          )
        }
      )}
      <div className="py-2">
        <div className="bg-gray-500/10 h-px" />
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
      ].map((item, i) => {
        return (
          <Link
            to={item.to}
            key={i}
            className={twMerge(linkClasses, 'font-normal')}
            activeProps={{
              className: twMerge(
                '!font-bold bg-gray-500/10 dark:bg-gray-500/30'
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
        <div className="font-black">TanStack</div>
      </Link>
      <div className="flex items-center gap-1">
        <a
          href="https://x.com/tan_stack"
          className="opacity-70 hover:opacity-100"
        >
          <FaTwitter className="text-xl" />
        </a>
        <a
          href="https://instagram.com/tan_stack"
          className="opacity-70 hover:opacity-100"
        >
          <FaInstagram className="text-xl" />
        </a>
      </div>
    </div>
  )

  const smallMenu = (
    <div className="lg:hidden bg-white dark:bg-gray-900 sticky top-0 z-20">
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500 border-opacity-20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
        </summary>
        <div
          className="flex flex-col gap-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          <div className="p-2 pb-0">
            <ClientOnlySearchButton {...searchButtonParams} />
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
      <div className="min-w-[250px] hidden lg:flex flex-col h-screen sticky top-0 z-20 bg-white dark:bg-gray-900 shadow-xl dark:border-r border-gray-500/20">
        <div className="p-4 flex gap-2 items-center text-2xl border-b border-gray-500/10 dark:border-gray-500/20">
          {logo}
        </div>
        <div className="p-2">
          <ClientOnlySearchButton {...searchButtonParams}>
            Search
          </ClientOnlySearchButton>
        </div>
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[300px]">
          <div className="space-y-1 text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
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
        {library?.scarfId ? <Scarf id={library.scarfId} /> : null}
        <Outlet />
      </div>
      {mounted ? (
        <div className="fixed z-50">
          <OramaSearchBox {...searchBoxParams} />
        </div>
      ) : null}
    </div>
  )
}
