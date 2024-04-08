import * as React from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  defer,
  useParams,
} from '@tanstack/react-router'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { twMerge } from 'tailwind-merge'
import { sortBy } from '~/utils/utils'
import logoColor100w from '~/images/logo-color-100w.png'
import { FaInstagram, FaTshirt, FaTwitter } from 'react-icons/fa'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import { getLibrary, libraries } from '~/libraries'
import { Scarf } from '~/components/Scarf'

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

  const items = (
    <>
      {sortBy(libraries, (d) => !d.name.includes('TanStack')).map(
        (project, i) => {
          const linkClasses = twMerge(
            `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500 hover:bg-opacity-10 font-black`
          )

          const [prefix, name] = project.name.split(' ')

          return (
            <div key={i}>
              {project.to.startsWith('http') ? (
                <a href={project.to} className={linkClasses}>
                  <span>
                    <span className="font-light dark:font-bold dark:opacity-40">
                      {prefix}
                    </span>{' '}
                    <span className={project.textStyle}>{name}</span>
                  </span>
                </a>
              ) : (
                <Link
                  to={project.to}
                  onClick={() => {
                    detailsRef.current.removeAttribute('open')
                  }}
                  // activeOptions={{
                  //   exact: true,
                  // }}
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
                        <span>
                          <span
                            className={twMerge(
                              'font-light dark:font-bold dark:opacity-40',
                              props.isActive ? `font-bold dark:opacity-100` : ''
                            )}
                          >
                            {prefix}
                          </span>{' '}
                          <span className={project.textStyle}>{name}</span>
                        </span>
                        {project.badge ? (
                          <span
                            className={twMerge(
                              `px-2 py-px uppercase font-black bg-gray-500/10 dark:bg-gray-500/20 rounded-full text-[.7rem] group-hover:opacity-100 transition-opacity text-white animate-pulse`,
                              // library.badge === 'new'
                              //   ? 'text-green-500'
                              //   : library.badge === 'soon'
                              //   ? 'text-cyan-500'
                              //   : '',
                              project.textStyle
                            )}
                          >
                            {project.badge}
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
      <a
        href="https://cottonbureau.com/people/tanstack"
        className="flex items-center gap-2 p-2"
        key="merch"
      >
        <FaTshirt className="text-2xl" />
        <span className="font-black text-lg">Merch!</span>
        <span
          className={twMerge(
            `ml-auto px-2 py-px uppercase font-black bg-gray-500/10 dark:bg-gray-500/20 rounded-full text-[.7rem] group-hover:opacity-100 transition-opacity animate-pulse text-green-500`
          )}
        >
          New
        </span>
      </a>
    </>
  )

  const logo = (
    <div className="flex-1 flex items-center gap-4 justify-between">
      <Link to="/" className={twMerge(`flex items-center gap-1.5`)}>
        <img
          src={logoColor100w}
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
    </div>
  )
}
