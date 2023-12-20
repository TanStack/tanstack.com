import * as React from 'react'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { Link, NavLink, Outlet } from '@remix-run/react'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { Carbon } from '~/components/Carbon'
import { seo } from '~/utils/seo'
import type { MetaFunction } from '@remix-run/node'

export const ErrorBoundary = DefaultErrorBoundary

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to="" className={`font-bold`}>
      <span
        className="inline-block text-transparent bg-clip-text
            bg-gradient-to-r from-rose-500 via-purple-500 to-yellow-500"
      >
        Blog
      </span>
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

export const meta: MetaFunction = () => {
  return seo({
    title: 'Blog | TanStack',
    description: 'The latest news and blog posts from TanStack!',
  })
}

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
      <div></div>
      <div className="flex-1 flex flex-col gap-4 px-4 whitespace-nowrap overflow-y-auto text-base">
        {menuItems}
      </div>
      <div className="carbon-small absolute bottom-0 w-full">
        <Carbon />
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
}
