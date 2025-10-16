import * as React from 'react'
import {
  Link,
  LinkOptions,
  Outlet,
  createFileRoute,
} from '@tanstack/react-router'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { FaHome, FaUser, FaUsers } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'
// Using public asset URL
import { ClientAdminAuth } from '~/components/ClientAuth'

export const Route = createFileRoute('/admin')({
  component: () => {
    return (
      <ClientAdminAuth>
        <AdminLayout>
          <Outlet />
        </AdminLayout>
      </ClientAdminAuth>
    )
  },
  staticData: {
    Title: () => {
      return (
        <Link to="." className="hover:text-blue-500">
          Admin
        </Link>
      )
    },
  },
})

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const detailsRef = React.useRef<HTMLElement>(null!)

  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const adminItems: (LinkOptions & { label: string; icon: React.ReactNode })[] =
    [
      {
        label: 'Admin Dashboard',
        icon: <FaHome />,
        to: '/admin',
        activeOptions: {
          exact: true,
        },
      },
      {
        label: 'Users',
        icon: <FaUsers />,
        to: '/admin/users',
      },
      {
        label: 'My Account',
        icon: <FaUser />,
        to: '/account',
      },
    ]

  const menuItems = (
    <>
      {adminItems.map((item, i) => (
        <Link
          to={item.to}
          key={i}
          className={twMerge(linkClasses, 'font-normal')}
          activeProps={{
            className: twMerge('font-bold! bg-gray-500/10 dark:bg-gray-500/30'),
          }}
          activeOptions={item.activeOptions}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 justify-between">
              {item.icon}
            </div>
            <div>{item.label}</div>
          </div>
        </Link>
      ))}
    </>
  )

  const smallMenu = (
    <div
      className="lg:hidden bg-white/50 sticky top-[var(--navbar-height)]
    max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto z-20 dark:bg-black/60 backdrop-blur-lg"
    >
      <details
        ref={detailsRef as any}
        id="docs-details"
        className="border-b border-gray-500/20"
      >
        <summary className="py-2 px-4 flex gap-2 items-center justify-between">
          <div className="flex-1 flex gap-4 items-center">
            <CgMenuLeft className="icon-open cursor-pointer" />
            <CgClose className="icon-close cursor-pointer" />
            Admin Menu
          </div>
        </summary>
        <div className="flex flex-col gap-1 p-4 whitespace-nowrap overflow-y-auto border-t border-gray-500/20 bg-white/20 text-base dark:bg-black/20">
          {menuItems}
        </div>
      </details>
    </div>
  )

  const largeMenu = (
    <div
      className="bg-white/50 dark:bg-black/30 shadow-xl max-w-[300px] xl:max-w-[350px] 2xl:max-w-[400px]
      hidden lg:flex flex-col gap-4 sticky
      h-[calc(100dvh-var(--navbar-height))] lg:top-[var(--navbar-height)]
      z-20 dark:border-r
      border-gray-500/20 transition-all duration-500 py-2"
    >
      <div className="flex-1 flex flex-col gap-1 text-sm px-4 whitespace-nowrap overflow-y-auto pb-8">
        {menuItems}
      </div>
    </div>
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
    </div>
  )
}
