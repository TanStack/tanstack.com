import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Moon,
  ShoppingCart,
  MagnifyingGlass,
  List,
  Sparkle,
  Lifebuoy,
  Users,
  Path,
} from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { DsPage, DsSection } from '~/components/ds/DsKit'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { DiscordIcon } from '~/components/icons/DiscordIcon'
import { MegaMenuItem } from '~/components/MegaMenuItem'

export const Route = createFileRoute('/ds/navbar')({
  component: NavbarPage,
  head: () => ({
    meta: seo({
      title: 'Navbar | TanStack Design System',
      description:
        'The global site navigation bar — anatomy, spacing tokens, and responsive behavior. Source: src/components/Navbar.tsx.',
    }),
  }),
})

const PRIMARY_NAV = [
  'Libraries',
  'Learn',
  'Community',
  'Tools',
  'Merch',
  'Support',
]

/**
 * A static, non-fixed replica of the real site navbar for documentation.
 *
 * The live `Navbar` (src/components/Navbar.tsx) is a `fixed` layout organism
 * that wraps the whole page and depends on router/auth/cart context, so it
 * can't be rendered inline. This mirror uses the same production classes and
 * the shared `--navbar-height` token so the anatomy stays true to the source.
 *
 * Responsiveness is driven by CONTAINER queries (`@min-[…]`) rather than the
 * viewport, so it reflects the width of its `@container` wrapper — letting the
 * preview show mobile / tablet / desktop states at any screen size. The
 * breakpoints mirror the real navbar: primary nav appears at 900px, social
 * links at 1120px.
 */
function NavbarAnatomy() {
  return (
    <div className="flex h-[var(--navbar-height)] w-full items-center justify-between gap-4 rounded-lg border border-gray-500/20 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-lg @min-[900px]:px-5 dark:bg-black/90">
      {/* Brand — the real landscape logo, theme-swapped like the live navbar */}
      <div className="flex shrink-0 items-center">
        <img
          src="/images/brand/tanstack-landscape-black.svg"
          alt="TanStack"
          className="h-7 w-auto dark:hidden"
        />
        <img
          src="/images/brand/tanstack-landscape-white.svg"
          alt="TanStack"
          aria-hidden="true"
          className="hidden h-7 w-auto dark:block"
        />
      </div>

      {/* Primary navigation — desktop only (≥ 900px) */}
      <nav className="hidden items-center gap-1 @min-[900px]:flex">
        {PRIMARY_NAV.map((label) => (
          <span
            key={label}
            className="rounded-md px-2 py-2 text-[13px] font-medium text-gray-700 @min-[1120px]:px-3 dark:text-gray-300"
          >
            {label}
          </span>
        ))}
      </nav>

      {/* Utility cluster */}
      <div className="flex items-center gap-2 text-gray-500 @min-[400px]:gap-2.5 dark:text-gray-400">
        {/* Social links — wide only (≥ 1120px) */}
        <GithubIcon className="hidden h-4 w-4 @min-[1120px]:block" />
        <DiscordIcon className="hidden h-4 w-4 @min-[1120px]:block" />
        <span className="hidden h-4 w-px bg-gray-500/20 @min-[1120px]:block" />
        <Moon className="h-[18px] w-[18px]" />
        <ShoppingCart className="h-[18px] w-[18px]" />
        <MagnifyingGlass className="h-[18px] w-[18px]" />
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-500/25 px-1.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
          <Sparkle className="h-3 w-3" weight="fill" />
          AI
        </span>
        {/* Log In — desktop only (≥ 900px) */}
        <span className="hidden items-center rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white @min-[900px]:inline-flex dark:bg-white dark:text-black">
          Log In
        </span>
        {/* Hamburger — mobile only (< 900px) */}
        <List className="h-5 w-5 @min-[900px]:hidden" />
      </div>
    </div>
  )
}

const PREVIEW_SIZES = [
  { key: 'auto', label: 'Auto', width: null },
  { key: 'mobile', label: 'Mobile', width: 390 },
  { key: 'ipad', label: 'iPad', width: 1024 },
  { key: 'desktop', label: 'Desktop', width: 1440 },
] as const

type PreviewSizeKey = (typeof PREVIEW_SIZES)[number]['key']

/**
 * The Anatomy preview surface with a device-size toggle. "Auto" fills the
 * available width, so the replica responds to the real screen as it resizes;
 * Mobile / iPad / Desktop pin the container to a fixed width (scrolling if it
 * overflows the frame). All sizing flows through the `@container` wrapper.
 */
function NavbarAnatomyPreview() {
  const [size, setSize] = React.useState<PreviewSizeKey>('auto')
  const [available, setAvailable] = React.useState(0)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const active = PREVIEW_SIZES.find((option) => option.key === size)!
  const deviceWidth = active.width

  // Measure the frame's inner width so wider device sizes can scale to fit.
  React.useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setAvailable(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale =
    deviceWidth && available > 0 && deviceWidth > available
      ? available / deviceWidth
      : 1

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-background-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-2.5">
        <div className="flex gap-1 rounded-lg border border-border-subtle bg-background-surface p-1">
          {PREVIEW_SIZES.map((option) => {
            const isActive = size === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSize(option.key)}
                className={
                  'rounded-md px-2.5 py-1 text-ds-label-md transition-colors ' +
                  (isActive
                    ? 'bg-background-inverse text-text-inverse'
                    : 'text-text-secondary hover:bg-background-subtle')
                }
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <span className="font-ds-mono text-[11px] text-text-muted">
          {deviceWidth
            ? `${deviceWidth}px${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}`
            : 'Responsive · tracks screen'}
        </span>
      </div>

      <div className="overflow-hidden bg-background-subtle p-6 sm:p-8">
        <div ref={trackRef} className="w-full">
          {deviceWidth ? (
            <div
              className="mx-auto overflow-hidden"
              style={{
                width: deviceWidth * scale,
                height: `calc(var(--navbar-height) * ${scale})`,
              }}
            >
              <div
                className="@container"
                style={{
                  width: deviceWidth,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <NavbarAnatomy />
              </div>
            </div>
          ) : (
            <div className="@container w-full">
              <NavbarAnatomy />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RegionCard({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border-default bg-background-surface p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-background-inverse font-ds-mono text-[11px] font-bold text-text-inverse">
          {index}
        </span>
        <span className="font-ds-display text-ds-heading-5 text-text-primary">
          {title}
        </span>
      </div>
      <p className="mt-2 text-ds-body-sm text-text-secondary">{children}</p>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="text-ds-body-sm text-text-secondary">{label}</span>
      <code className="text-right font-ds-mono text-[12px] text-text-primary">
        {value}
      </code>
    </div>
  )
}

function NavbarPage() {
  return (
    <DsPage
      title="Navbar"
      description="The global navigation bar that sits fixed at the top of every TanStack surface. It's a layout organism — brand, primary mega-menu navigation, and a utility cluster — and adapts from a full desktop bar to a compact mobile menu. Source: src/components/Navbar.tsx."
    >
      <DsSection
        title="Anatomy"
        description="A static replica built from the production classes and the shared --navbar-height token. Toggle a device size, or leave it on Auto to watch it reflow with the screen — driven by container queries, so it mirrors the real navbar's 900px / 1120px breakpoints at any width."
      >
        <NavbarAnatomyPreview />
      </DsSection>

      <DsSection
        title="Mega menu item"
        description="The row used inside the primary-nav mega menus — a bordered icon square, a Bricolage-bold title (heading-5), and a muted body-xs description. Rest / hover / press apply a mode-adaptive overlay. Source: src/components/MegaMenuItem.tsx."
      >
        <div className="flex justify-center rounded-xl border border-border-default bg-background-subtle p-6 sm:p-8">
          <div className="flex w-max flex-col gap-2 rounded-xl border border-border-default bg-background-surface p-2 shadow-sm">
            <MegaMenuItem
              icon={Lifebuoy}
              title="Support Overview"
              description="Find the right support path."
              to="/ds/navbar"
            />
            <MegaMenuItem
              icon={Users}
              title="Enterprise Support"
              description="Private consulting and expert support."
              to="/ds/navbar"
            />
            <MegaMenuItem
              icon={Path}
              title="Migration guides"
              description="Move from other libraries with confidence."
              to="/ds/navbar"
              badge="New"
            />
          </div>
        </div>
      </DsSection>

      <DsSection
        title="Regions"
        description="Three regions laid out with flex justify-between: brand on the left, primary navigation centered, utilities on the right."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <RegionCard index={1} title="Brand">
            Logo mark and wordmark, linking home. Right-clicking opens the brand
            context menu (logo assets, Brand Guide).
          </RegionCard>
          <RegionCard index={2} title="Primary nav">
            Libraries, Learn, Community, Tools, Merch, and Support — each a
            hover/focus mega-menu. Collapses into the mobile menu below 900px.
          </RegionCard>
          <RegionCard index={3} title="Utility cluster">
            Social links, theme toggle, cart, search, the AI dock, and auth
            controls — plus the hamburger trigger on mobile.
          </RegionCard>
        </div>
      </DsSection>

      <DsSection
        title="Layout & spacing"
        description="The tokens and utilities that give the bar its rhythm. Height is driven by a CSS variable so sticky offsets across the site stay in sync."
      >
        <div className="rounded-xl border border-border-default bg-background-surface px-4 py-1">
          <SpecRow label="Height" value="--navbar-height: 58px" />
          <SpecRow
            label="Container padding"
            value="px-3 py-2 · min-[900px]:px-5"
          />
          <SpecRow label="Region gap" value="gap-2 · min-[1120px]:gap-4" />
          <SpecRow label="Primary nav item gap" value="gap-1" />
          <SpecRow label="Utility cluster gap" value="gap-2 · sm:gap-2.5" />
          <SpecRow
            label="Nav trigger padding"
            value="px-2 py-2 · min-[1120px]:px-3"
          />
          <SpecRow
            label="Nav trigger text"
            value="text-xs · min-[1120px]:text-[13px]"
          />
          <SpecRow label="Surface" value="bg-white/90 dark:bg-black/90" />
          <SpecRow label="Border" value="border-b border-gray-500/20" />
        </div>
      </DsSection>

      <DsSection
        title="Responsive behavior"
        description="Two breakpoints reshape the bar as space tightens."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <RegionCard index={900} title="≥ 900px — Desktop">
            Full primary navigation with mega-menu dropdowns; the hamburger is
            hidden.
          </RegionCard>
          <RegionCard index={1120} title="≥ 1120px — Wide">
            Social links join the utility cluster and region gaps widen for
            extra breathing room.
          </RegionCard>
          <RegionCard index={0} title="< 900px — Mobile">
            Primary nav collapses to a hamburger that opens a full-width
            collapsible menu below the bar.
          </RegionCard>
        </div>
      </DsSection>

      <DsSection
        title="Source"
        description="This organism lives in the app, not the copy-paste registry — it's wired to routing, auth, and cart state."
      >
        <div className="rounded-xl border border-border-default bg-background-surface p-4">
          <code className="font-ds-mono text-[13px] text-text-primary">
            src/components/Navbar.tsx
          </code>
          <p className="mt-2 text-ds-body-sm text-text-muted">
            Mounted once in <code className="font-ds-mono">__root.tsx</code> as{' '}
            <code className="font-ds-mono">
              {'<Navbar>{children}</Navbar>'}
            </code>
            . Menu contents are defined in the{' '}
            <code className="font-ds-mono">NAV_GROUPS</code> config at the top
            of the file.
          </p>
        </div>
      </DsSection>
    </DsPage>
  )
}
