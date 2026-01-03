import * as React from 'react'
import {
  Link,
  LinkOptions,
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import {
  X,
  TextAlignStart,
  LayoutDashboard,
  LogIn,
  MessagesSquare,
  Rss,
  Shield,
  ShieldHalf,
  StickyNote,
  Users,
  User,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
// Using public asset URL
import { ClientAdminAuth } from '~/components/ClientAuth'
import { requireAnyAdminCapability } from '~/utils/auth.server'
import { useCapabilities } from '~/hooks/useCapabilities'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { NpmIcon } from '~/components/icons/NpmIcon'
import { Sparkles } from 'lucide-react'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    // Allow access if user has any admin-like capability
    // Each sub-route checks specific capabilities
    try {
      const user = await requireAnyAdminCapability()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
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
  const capabilities = useCapabilities()

  const linkClasses = `flex items-center justify-between group px-2 py-1 rounded-lg hover:bg-gray-500/10 font-black`

  const allAdminItems: (LinkOptions & {
    label: string
    icon: React.ReactNode
    requiredCapability?: string
  })[] = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard />,
      to: '/admin',
    },
    {
      label: 'Users',
      icon: <Users />,
      to: '/admin/users',
    },
    {
      label: 'Roles',
      icon: <ShieldHalf />,
      to: '/admin/roles',
    },
    {
      label: 'Login History',
      icon: <LogIn />,
      to: '/admin/logins',
    },
    {
      label: 'Audit Logs',
      icon: <Shield />,
      to: '/admin/audit',
    },
    {
      label: 'Feedback',
      icon: <MessagesSquare />,
      to: '/admin/feedback',
      requiredCapability: 'moderate-feedback',
    },
    {
      label: 'Notes',
      icon: <StickyNote />,
      to: '/admin/notes',
      requiredCapability: 'moderate-feedback',
    },
    {
      label: 'Showcases',
      icon: <Sparkles />,
      to: '/admin/showcases',
      requiredCapability: 'moderate-showcases',
    },
    {
      label: 'Feed',
      icon: <Rss />,
      to: '/admin/feed',
    },
    {
      label: 'GitHub Stats',
      icon: <GithubIcon />,
      to: '/admin/github-stats',
    },
    {
      label: 'NPM Stats',
      icon: <NpmIcon />,
      to: '/admin/npm-stats',
    },
    {
      label: 'My Account',
      icon: <User />,
      to: '/account',
    },
  ]

  // Filter menu items based on required capabilities
  // Admin users have access to everything
  // Non-admin users only see items they have specific capability for
  const isAdmin = capabilities.includes('admin')
  const adminItems = allAdminItems.filter((item) => {
    // Items without requiredCapability are admin-only
    if (!item.requiredCapability) return isAdmin
    // Items with requiredCapability: admin sees all, others need the capability
    return isAdmin || capabilities.includes(item.requiredCapability as any)
  })

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
            <TextAlignStart className="icon-open cursor-pointer" />
            <X className="icon-close cursor-pointer" />
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
      className="bg-white dark:bg-black/30 shadow-xl max-w-[300px] xl:max-w-[350px] 2xl:max-w-[400px]
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
      <div className="flex flex-1 min-h-0 min-w-0 relative justify-center">
        {children}
      </div>
    </div>
  )
}
