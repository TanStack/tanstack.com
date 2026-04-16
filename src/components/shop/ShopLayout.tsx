import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Menu,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  X,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useLocalStorage } from '~/utils/useLocalStorage'
import type { CollectionListItem } from '~/utils/shopify-queries'
import { CartDrawer } from './CartDrawer'
import { useCartDrawerStore } from './cartDrawerStore'

type ShopLayoutProps = {
  collections: Array<CollectionListItem>
  children: React.ReactNode
}

const POLICY_PAGES = [
  { handle: 'shipping-policy', label: 'Shipping' },
  { handle: 'refund-policy', label: 'Returns' },
  { handle: 'privacy-policy', label: 'Privacy' },
  { handle: 'terms-of-service', label: 'Terms' },
] as const

/**
 * /shop layout: persistent left sidebar on md+, slide-in drawer on mobile.
 * Collapse state persists to localStorage. When collapsed, hovering the
 * rail expands it as an overlay without shifting the main content.
 */
export function ShopLayout({ collections, children }: ShopLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorage(
    'shopSidebarCollapsed',
    false,
  )
  const [isHoverExpanded, setIsHoverExpanded] = React.useState(false)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)

  const showExpanded = !isCollapsed || isHoverExpanded

  return (
    <div className="relative min-h-[calc(100vh-var(--navbar-height,0px))]">
      {/* Mobile menu toggle (absolute, shown only on mobile) */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed left-4 top-[calc(var(--navbar-height,56px)+0.75rem)] z-30 p-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-sm"
        aria-label="Open shop menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile backdrop */}
      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Close shop menu"
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40"
        />
      ) : null}

      {/*
       * Shop sidebar — anchored to the viewport's left rail (fixed), full
       * height below the navbar. The main site nav is also a fixed flyout
       * at z-50, so it will overlay this sidebar when the user hovers the
       * logo / expands it — that's the expected UX.
       */}
      <aside
        onMouseEnter={() => isCollapsed && setIsHoverExpanded(true)}
        onMouseLeave={() => isCollapsed && setIsHoverExpanded(false)}
        className={twMerge(
          // Fixed to the viewport's left rail
          'fixed left-0 top-0 md:top-[var(--navbar-height,0px)] bottom-0 z-40 md:z-20',
          'bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800',
          'transition-[width,transform] duration-200 ease-out',
          'flex flex-col',
          // Width: reserved rail vs. hover-expanded overlay
          showExpanded ? 'w-60' : 'w-14',
          // Mobile translate
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Shadow when floating as hover-expand overlay
          isCollapsed && isHoverExpanded
            ? 'md:shadow-xl md:border-r-transparent'
            : '',
        )}
      >
        {/* Mobile close */}
        <div className="md:hidden flex justify-end p-2">
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close shop menu"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ShopSidebarNav
          collections={collections}
          showLabels={showExpanded}
          onNavigate={() => setIsMobileOpen(false)}
        />

        {/* Desktop collapse toggle pinned to bottom */}
        <div className="hidden md:flex mt-auto border-t border-gray-200 dark:border-gray-800 p-2">
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(!isCollapsed)
              setIsHoverExpanded(false)
            }}
            aria-label={
              isCollapsed ? 'Expand shop sidebar' : 'Collapse shop sidebar'
            }
            className={twMerge(
              'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs',
              'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900',
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/*
       * Main content — padded left by the sidebar's collapsed/expanded width
       * so it never sits beneath the fixed rail. On mobile the sidebar is a
       * slide-in drawer, so no padding is reserved there.
       */}
      <main
        className={twMerge(
          'min-w-0 transition-[padding-left] duration-200',
          isCollapsed ? 'md:pl-14' : 'md:pl-60',
        )}
      >
        {children}
      </main>

      <ShopCartDrawer />
    </div>
  )
}

function ShopCartDrawer() {
  const open = useCartDrawerStore((s) => s.open)
  const setOpen = useCartDrawerStore((s) => s.setOpen)
  return <CartDrawer open={open} onOpenChange={setOpen} />
}

function ShopSidebarNav({
  collections,
  showLabels,
  onNavigate,
}: {
  collections: Array<CollectionListItem>
  showLabels: boolean
  onNavigate: () => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-6">
      <SidebarSection label="Shop" showLabels={showLabels}>
        <SidebarLink
          to="/shop"
          label="All Products"
          icon={ShoppingBag}
          showLabels={showLabels}
          onNavigate={onNavigate}
          exact
        />
        <SidebarLink
          to="/shop/search"
          label="Search"
          icon={Search}
          showLabels={showLabels}
          onNavigate={onNavigate}
        />
        <SidebarLink
          to="/shop/cart"
          label="Cart"
          icon={ShoppingCart}
          showLabels={showLabels}
          onNavigate={onNavigate}
        />
      </SidebarSection>

      {collections.length > 0 ? (
        <SidebarSection label="Collections" showLabels={showLabels}>
          {collections.map((c) => (
            <SidebarLink
              key={c.id}
              to="/shop/collections/$handle"
              params={{ handle: c.handle }}
              label={c.title}
              icon={Package}
              showLabels={showLabels}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}

      <SidebarSection label="Info" showLabels={showLabels}>
        {POLICY_PAGES.map((page) => (
          <SidebarLink
            key={page.handle}
            to="/shop/pages/$handle"
            params={{ handle: page.handle }}
            label={page.label}
            icon={FileText}
            showLabels={showLabels}
            onNavigate={onNavigate}
          />
        ))}
      </SidebarSection>
    </nav>
  )
}

function SidebarSection({
  label,
  showLabels,
  children,
}: {
  label: string
  showLabels: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={twMerge(
          'text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 px-2 h-5 flex items-center',
          showLabels ? 'opacity-100' : 'opacity-0',
        )}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

type IconComponent = React.ComponentType<{ className?: string }>

function SidebarLink({
  to,
  params,
  label,
  icon: Icon,
  showLabels,
  onNavigate,
  exact,
}: {
  to: string
  params?: Record<string, string>
  label: string
  icon: IconComponent
  showLabels: boolean
  onNavigate: () => void
  exact?: boolean
}) {
  const { pathname } = useLocation()
  // Resolve a simple active check without depending on to-typing details
  const resolvedHref = params
    ? to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? '')
    : to
  const isActive = exact
    ? pathname === resolvedHref
    : pathname === resolvedHref || pathname.startsWith(`${resolvedHref}/`)

  return (
    <Link
      // Cast to `any` is intentional: sidebar links are built from typed
      // route literals, but collections come from a dynamic server list,
      // so the union of safe paths is wider than inference can handle here.
      to={to as any}
      params={params as any}
      onClick={onNavigate}
      title={showLabels ? undefined : label}
      className={twMerge(
        'flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors',
        'hover:bg-gray-100 dark:hover:bg-gray-900',
        isActive
          ? 'bg-gray-100 dark:bg-gray-900 font-semibold'
          : 'text-gray-700 dark:text-gray-300',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span
        className={twMerge(
          'whitespace-nowrap transition-opacity duration-150',
          showLabels ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {label}
      </span>
    </Link>
  )
}
