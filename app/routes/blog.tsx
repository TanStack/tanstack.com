import * as React from 'react'
import {
  DefaultGlobalNotFound,
  Link,
  Outlet,
  createFileRoute,
} from '@tanstack/react-router'
import { Carbon } from '~/components/Carbon'
import { seo } from '~/utils/seo'
import { CgClose, CgMenuLeft } from 'react-icons/cg'

const logo = (
  <>
    <Link to="/" className="font-light">
      TanStack
    </Link>
    <Link to="." className={`font-bold`}>
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
        label: 'Latest Posts',
        to: '.',
      },
    ],
  },
] as const

export const Route = createFileRoute('/blog')({
  meta: () =>
    seo({
      title: 'Blog | TanStack',
      description: 'The latest news and blog posts from TanStack!',
    }),
  component: Blog,
})

export function PostNotFound() {
  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="opacity-10 flex flex-col text-center font-black">
        <div className="text-7xl leading-none">404</div>
        <div className="text-3xl leading-none">Not Found</div>
      </h1>
      <div className="text-lg">Post not found.</div>
      <Link
        to="/blog"
        className={`py-2 px-4 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
      >
        Blog Home
      </Link>
    </div>
  )
}

function Blog() {
  const detailsRef = React.useRef<HTMLDetailsElement>(null!)

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
                  <Link
                    to={child.to}
                    activeProps={{
                      className: `font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-600`,
                    }}
                    onClick={() => {
                      detailsRef.current.removeAttribute('open')
                    }}
                    activeOptions={{
                      exact: true,
                    }}
                  >
                    {child.label}
                  </Link>
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
