import * as React from 'react'
import { Link, LinkOptions, Outlet } from '@tanstack/react-router'
import { CgClose, CgMenuLeft } from 'react-icons/cg'
import { FaHome, FaLock, FaUser, FaUsers } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'
import logoColor100w from '~/images/logo-color-100w.png'
import { ThemeToggle } from '~/components/ThemeToggle'
import { useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'

export const Route = createFileRoute({
  beforeLoad: async ({ context }) => {
    await context.ensureUser()
  },
  component: () => {
    return (
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    )
  },
})

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.auth.getCurrentUser)
  const detailsRef = React.useRef<HTMLElement>(null!)

  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const canAdmin = user?.capabilities.includes('admin')

  // If not authenticated, show loading
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  // If authenticated but no admin capability, show unauthorized
  if (user && !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaLock className="text-4xl text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
          <Link
            to="/"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

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

  const logo = (
    <div className="flex-1 flex items-center gap-4 justify-between">
      <Link to="/" className={twMerge(`flex items-center gap-1.5`)}>
        <img
          src={logoColor100w}
          alt=""
          className="w-[30px] rounded-full overflow-hidden border-2 border-black dark:border-none"
        />
        <div className="font-black text-xl uppercase">
          TanStack <span className="font-light">Admin</span>
        </div>
      </Link>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </div>
  )

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
    <div className="lg:hidden bg-white/50 dark:bg-black/60 sticky top-0 z-20 backdrop-blur-[20px]">
      <details
        ref={detailsRef as any}
        id="admin-details"
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
          <div className="space-y-px text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
            {menuItems}
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
        <div className="flex-1 flex flex-col gap-4 whitespace-nowrap overflow-y-auto text-base pb-[50px]">
          <div className="flex flex-col gap-1 text-sm p-2 border-b border-gray-500/10 dark:border-gray-500/20">
            {menuItems}
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
    </div>
  )
}
