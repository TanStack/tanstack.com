import * as React from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { ErrorBoundaryComponent, Link, NavLink, Outlet } from 'remix'
import { useMatchesData } from '~/utils/utils'
import { DocSearch } from '@docsearch/react'
import { gradientText } from './index'
import { Search } from './table/export function Search () {'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'

export const ErrorBoundary = DefaultErrorBoundary

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to="" className={`font-bold`}>
      <span className={`${gradientText}`}>Blog</span>
    </Link>
  </>
)

const localMenu = [
  {
    label: 'Blog',
    children: [
      {
        label: 'Latest',
        to: '',
      },
    ],
  },
] as const

export default function RouteBlog() {
  const detailsRef = React.useRef<HTMLElement>(null!)

  const menuItems = localMenu.map((group) => {
    return (
      <div key={group.label}>
        <div className="text-[.9em] uppercase font-black">{group.label}</div>
        <div className="h-2" />
        <div className="pl-2 space-y-2 text-[.9em]">
          {group.children?.map((child, i) => {
            return (
              <div key={i}>
                {child.to.startsWith('http') ? (
                  <a href={child.to}>{child.label}</a>
                ) : (
                  <NavLink
                    to={child.to}
                    className={(props) =>
                      props.isActive
                        ? `font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-600`
                        : ''
                    }
                    onClick={() => {
                      detailsRef.current.removeAttribute('open')
                    }}
                    end
                  >
                    {child.label}
                  </NavLink>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  })

  const smallMenu = (
    <div
      className="lg:hidden bg-white sticky top-0 z-20
              dark:bg-black"
    >
      <details
        ref={detailsRef}
        id="docs-details"
        className="border-b border-gray-500 border-opacity-20"
      >
        <summary className="p-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center text-xl md:text-2xl">
            <CgMenuLeft className="icon-open mr-2 cursor-pointer" />
            <CgClose className="icon-close mr-2 cursor-pointer" />
            {logo}
          </div>
          <Search />
        </summary>
        <div
          className="flex flex-col gap-4 p-4 whitespace-nowrap h-[0vh] overflow-y-auto
          border-t border-gray-500 border-opacity-20 bg-gray-100 text-lg
          dark:bg-gray-900"
        >
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div className="hidden w-[250px] lg:flex flex-col gap-4 h-screen sticky top-0 z-20">
      <div className="px-4 pt-4 flex gap-2 items-center text-2xl">{logo}</div>
      <div>
        <Search />
      </div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base">
        {menuItems}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {smallMenu}
      {largeMenu}
      <div className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  )
  //  : (
  //   <div className="flex items-start min-h-0 h-screen">
  //     <div
  //       className="p-8 flex w-[300px] min-h-0 h-screen overflow-y-auto
  //       flex-col gap-4 whitespace-nowrap"
  //     >
  //       <div className="flex flex-col text-2xl">{logo}</div>
  //       {menu}
  //     </div>
  //     <div className="flex-1 h-screen pl-4 overflow-y-auto flex flex-col">
  //       <div className="h-12" />
  //       <div className="flex-1 min-h-0">
  //         <Outlet />
  //       </div>
  //     </div>
  //   </div>
  // )
}
