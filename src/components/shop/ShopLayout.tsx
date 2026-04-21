import * as React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  Menu,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useLocalStorage } from '~/utils/useLocalStorage'
import type { CollectionListItem, PolicySummary } from '~/utils/shopify-queries'
import { CartDrawer } from './CartDrawer'
import { useCartDrawerStore } from './cartDrawerStore'
import { ShopLabel } from './ui'

type IconComponent = React.ComponentType<{ className?: string }>

type ShopLayoutProps = {
  collections: Array<CollectionListItem>
  policies: Array<PolicySummary>
  children: React.ReactNode
}

const COLLECTION_ICON_MAP: Record<string, IconComponent> = {
  apparel: Shirt,
  accessories: Tag,
  'library-merch': Code,
}

/**
 * /shop layout: persistent left sidebar on md+, slide-in drawer on mobile.
 * Wraps children in a `.shop-scope` element so shop design tokens apply only
 * to /shop pages. Collapse state persists to localStorage; when collapsed,
 * hovering the rail expands it as an overlay.
 */
export function ShopLayout({
  collections,
  policies,
  children,
}: ShopLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorage(
    'shopSidebarCollapsed',
    false,
  )
  const [isHoverExpanded, setIsHoverExpanded] = React.useState(false)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)

  const showExpanded = !isCollapsed || isHoverExpanded

  return (
    <div className="shop-scope relative min-h-[calc(100vh-var(--navbar-height,0px))]">
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open shop menu"
        className="md:hidden fixed left-4 top-[calc(var(--navbar-height,56px)+0.75rem)] z-30 p-2 rounded-md bg-shop-panel border border-shop-line text-shop-text"
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

      <aside
        onMouseEnter={() => isCollapsed && setIsHoverExpanded(true)}
        onMouseLeave={() => isCollapsed && setIsHoverExpanded(false)}
        className={twMerge(
          'fixed left-0 top-0 md:top-[var(--navbar-height,0px)] bottom-0 z-40 md:z-20',
          'bg-shop-bg border-r border-shop-line',
          'transition-[width,transform] duration-200 ease-out flex flex-col',
          showExpanded ? 'w-60' : 'w-14',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          isCollapsed && isHoverExpanded
            ? 'md:shadow-xl md:border-r-transparent'
            : '',
        )}
      >
        <div className="md:hidden flex justify-end p-2">
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close shop menu"
            className="p-2 rounded-md hover:bg-shop-panel text-shop-text-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ShopSidebarNav
          collections={collections}
          policies={policies}
          showLabels={showExpanded}
          onNavigate={() => setIsMobileOpen(false)}
        />

        <div className="hidden md:flex mt-auto border-t border-shop-line p-2">
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(!isCollapsed)
              setIsHoverExpanded(false)
            }}
            aria-label={
              isCollapsed ? 'Expand shop sidebar' : 'Collapse shop sidebar'
            }
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-shop-text-2 hover:text-shop-text hover:bg-shop-panel transition-colors"
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
  policies,
  showLabels,
  onNavigate,
}: {
  collections: Array<CollectionListItem>
  policies: Array<PolicySummary>
  showLabels: boolean
  onNavigate: () => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-4">
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
              icon={COLLECTION_ICON_MAP[c.handle] ?? Sparkles}
              showLabels={showLabels}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}

      {policies.length > 0 ? (
        <SidebarSection label="Info" showLabels={showLabels}>
          {policies.map((policy) => (
            <SidebarLink
              key={policy.handle}
              to="/shop/policies/$handle"
              params={{ handle: policy.handle }}
              label={policy.title}
              icon={FileText}
              showLabels={showLabels}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      ) : null}
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
      <ShopLabel
        className={twMerge(
          'px-2.5 h-5 flex items-center transition-opacity',
          showLabels ? 'opacity-100' : 'opacity-0',
        )}
      >
        {label}
      </ShopLabel>
      {children}
    </div>
  )
}

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
        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors whitespace-nowrap overflow-hidden text-ellipsis',
        'text-shop-text-2 hover:bg-shop-panel hover:text-shop-text',
        isActive && 'bg-shop-panel text-shop-text',
      )}
    >
      <Icon
        className={twMerge(
          'w-3.5 h-3.5 shrink-0',
          isActive ? 'text-shop-text' : 'text-shop-muted',
        )}
      />
      <span
        className={twMerge(
          'transition-opacity duration-150',
          showLabels ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {label}
      </span>
    </Link>
  )
}
