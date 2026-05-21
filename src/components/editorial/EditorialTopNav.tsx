import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ArrowRight, Menu, Search, Sparkles, X } from 'lucide-react'

import { NetlifyImage } from '~/components/NetlifyImage'
import { ThemeToggle } from '~/components/ThemeToggle'
import { GitHub } from '~/ui'
import { BSkyIcon } from '~/components/icons/BSkyIcon'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { DiscordIcon } from '~/components/icons/DiscordIcon'
import { InstagramIcon } from '~/components/icons/InstagramIcon'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'
import {
  categoryMeta,
  categorySlugs,
} from '~/components/stack/stack-categories'
import { PartnerImage, partners, partnerTierFlares } from '~/utils/partners'

type NavItem =
  | { kind: 'category'; slug: (typeof categorySlugs)[number]; label: string }
  | { kind: 'link'; to: string; label: string; accent?: boolean }
  | { kind: 'external'; href: string; label: string }

const PRIMARY_LINKS: NavItem[] = [
  ...categorySlugs.map((slug) => ({
    kind: 'category' as const,
    slug,
    label: categoryMeta[slug].shortName,
  })),
  { kind: 'link', to: '/libraries', label: 'Libraries' },
  { kind: 'link', to: '/partners', label: 'Partners' },
  { kind: 'link', to: '/blog', label: 'Blog' },
  { kind: 'link', to: '/showcase', label: 'Showcase' },
  { kind: 'link', to: '/stats', label: 'Stats' },
  { kind: 'link', to: '/merch', label: 'Merch' },
  { kind: 'link', to: '/explore', label: 'Explore', accent: true },
]

export function EditorialTopNav() {
  const [open, setOpen] = React.useState(false)
  const headerRef = React.useRef<HTMLElement>(null)

  // Publish height as --navbar-height so the global Navbar's sticky/fixed
  // left rail (which uses `top-[var(--navbar-height)]`) lines up underneath.
  React.useEffect(() => {
    const node = headerRef.current
    if (!node) return

    const update = () => {
      document.documentElement.style.setProperty(
        '--navbar-height',
        `${node.offsetHeight}px`,
      )
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80"
    >
      {/* Utility strip */}
      <div className="bg-zinc-900 text-white dark:bg-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-[11px] sm:text-xs">
          <p className="flex items-center gap-1.5 font-medium">
            <Sparkles size={12} className="text-amber-300" />
            The open-source application stack — built for developers, reliable
            for agents.
          </p>
          <p className="hidden text-zinc-400 sm:block">
            MIT licensed · Production-grade · No vendor lock-in
          </p>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-900 dark:text-white"
        >
          <NetlifyImage
            src="/images/logos/logo-color-100.png"
            alt=""
            width={28}
            height={28}
            className="block dark:hidden"
          />
          <NetlifyImage
            src="/images/logos/logo-color-100.png"
            alt=""
            width={28}
            height={28}
            className="hidden dark:block"
          />
          <span className="text-lg font-black uppercase tracking-tight">
            TanStack
          </span>
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <ul className="flex flex-wrap items-center justify-center gap-1 text-sm font-semibold">
            {PRIMARY_LINKS.map((item) => (
              <li key={getKey(item)} className="shrink-0">
                <NavLinkItem item={item} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2 ml-auto lg:ml-0">
          <button
            type="button"
            aria-label="Search (⌘K)"
            title="Search · ⌘K"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:flex dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Search size={16} />
          </button>

          <SocialCluster />

          <ThemeToggle />

          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Gold partners strip — pinned sponsor row */}
      <GoldPartnersStrip />

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <nav className="mx-auto max-w-7xl px-4 py-3">
            <ul className="space-y-1 text-sm font-semibold">
              {PRIMARY_LINKS.map((item) => (
                <li key={getKey(item)}>
                  <NavLinkItem item={item} onClick={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  )
}

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com/tanstack',
    Icon: GitHub,
  },
  {
    label: 'Discord',
    href: 'https://discord.com/invite/WrRKjPJ',
    Icon: DiscordIcon,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@tan_stack',
    Icon: YouTubeIcon,
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/tan_stack',
    Icon: BrandXIcon,
  },
  {
    label: 'Bluesky',
    href: 'https://bsky.app/profile/tanstack.com',
    Icon: BSkyIcon,
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/tan_stack',
    Icon: InstagramIcon,
  },
] as const

function SocialCluster() {
  return (
    <div
      className="hidden overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 sm:grid sm:grid-cols-3 sm:grid-rows-2 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="TanStack social channels"
    >
      {SOCIAL_LINKS.map(({ label, href, Icon }, i) => {
        const col = i % 3 // 0, 1, 2
        const row = Math.floor(i / 3) // 0 or 1
        return (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`TanStack on ${label}`}
            title={label}
            className={twMerge(
              'inline-flex h-6 w-7 items-center justify-center text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
              col > 0 && 'border-l border-zinc-200 dark:border-zinc-800',
              row > 0 && 'border-t border-zinc-200 dark:border-zinc-800',
            )}
          >
            <Icon className="h-3 w-3" />
          </a>
        )
      })}
    </div>
  )
}

function GoldPartnersStrip() {
  const goldFlare = partnerTierFlares.gold
  const goldPartners = React.useMemo(
    () =>
      partners
        .filter((p) => p.status !== 'inactive' && p.tier === 'gold')
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [],
  )

  if (goldPartners.length === 0) return null

  return (
    <div className="border-t border-zinc-200 bg-gradient-to-b from-amber-50/60 to-white dark:border-zinc-800 dark:from-amber-950/20 dark:to-zinc-950">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
        <Link
          to="/partners"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 shadow-sm ring-1 ring-amber-200 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-300 dark:ring-amber-900/50 dark:hover:bg-zinc-800"
        >
          <span
            className={twMerge(
              'inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br text-white',
              goldFlare.gradientStops,
            )}
          >
            {goldFlare.icon}
          </span>
          Gold partners
        </Link>

        <ul className="flex min-w-0 flex-1 items-center gap-x-6 gap-y-2 overflow-x-auto">
          {goldPartners.map((partner) => (
            <li key={partner.id} className="relative shrink-0">
              <a
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="group/partner inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                aria-label={`${partner.name} — sponsored partner`}
              >
                <span className="block h-6 w-[120px] sm:w-[140px]">
                  <PartnerImage
                    config={partner.image}
                    alt={partner.name}
                    className="h-full w-full object-contain opacity-80 transition-opacity group-hover/partner:opacity-100"
                  />
                </span>
                {partner.tagline && (
                  <span className="hidden text-xs font-semibold md:inline">
                    {partner.tagline}
                  </span>
                )}

                {/* Sponsored tooltip — appears on hover */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/partner:opacity-100 dark:bg-white dark:text-zinc-900"
                >
                  <span className="text-amber-300 dark:text-amber-600">
                    ★ Sponsored
                  </span>
                  <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-300 dark:text-zinc-600">
                    Gold partner
                  </span>
                  {/* arrow */}
                  <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-zinc-900 dark:bg-white" />
                </span>
              </a>
            </li>
          ))}
        </ul>

        <Link
          to="/partners"
          className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 sm:inline-flex dark:text-zinc-400 dark:hover:text-white"
        >
          See all partners
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

function NavLinkItem({
  item,
  onClick,
}: {
  item: NavItem
  onClick?: () => void
}) {
  const cls =
    'inline-flex items-center whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
  const activeCls = twMerge(
    cls,
    'bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 hover:text-white dark:bg-cyan-500 dark:text-white dark:hover:bg-cyan-400 dark:hover:text-white',
  )

  if (item.kind === 'category') {
    return (
      <Link
        to="/stack/$category"
        params={{ category: item.slug }}
        className={cls}
        activeProps={{ className: activeCls }}
        onClick={onClick}
      >
        {item.label}
      </Link>
    )
  }

  if (item.kind === 'link') {
    if (item.accent) {
      const accentCls =
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-2.5 py-1 text-[13px] text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md'
      const accentActive = twMerge(
        accentCls,
        'from-cyan-600 to-emerald-600 ring-2 ring-cyan-300 dark:ring-cyan-700',
      )
      return (
        <Link
          to={item.to}
          className={accentCls}
          activeProps={{ className: accentActive }}
          onClick={onClick}
        >
          <span aria-hidden className="text-[12px] leading-none">
            🎮
          </span>
          {item.label}
        </Link>
      )
    }
    return (
      <Link
        to={item.to}
        className={cls}
        activeProps={{ className: activeCls }}
        onClick={onClick}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      onClick={onClick}
    >
      {item.label}
    </a>
  )
}

function getKey(item: NavItem): string {
  if (item.kind === 'category') return `cat-${item.slug}`
  if (item.kind === 'link') return `link-${item.to}`
  return `ext-${item.href}`
}
