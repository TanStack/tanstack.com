import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ArrowSquareOut } from '@phosphor-icons/react'

type IconComponent = React.ComponentType<{ className?: string }>

export interface MegaMenuItemProps {
  /** Leading icon, shown in a bordered rounded square. */
  icon?: IconComponent
  title: React.ReactNode
  description?: React.ReactNode
  /** Internal route or external (http/mailto) URL. */
  to: string
  hash?: string
  badge?: string
  onNavigate?: () => void
  variant?: 'desktop' | 'mobile'
  /** Elevated variant used for standalone / featured rows. */
  compact?: boolean
  className?: string
}

function isExternal(to: string) {
  return to.startsWith('http') || to.startsWith('mailto:')
}

/**
 * A single mega-menu row — icon + title + description with rest / hover /
 * pressed states. Modeled on the Figma "Mega Menu Item" component: bordered
 * icon square, Bricolage-bold title (heading-5), muted body-xs description, and
 * a mode-adaptive overlay on hover/press. Used by the site Navbar and shown in
 * the design system at /ds/navbar.
 */
export function MegaMenuItem({
  icon: Icon,
  title,
  description,
  to,
  hash,
  badge,
  onNavigate,
  variant = 'desktop',
  compact,
  className,
}: MegaMenuItemProps) {
  const external = isExternal(to)

  const rootClassName = twMerge(
    // Figma "Mega Menu Item": gap 10px, pl 8 / pr 16 / py 8, radius 12px.
    'group/mmi flex items-center gap-2.5 rounded-xl py-2 pl-2 pr-4 text-left transition-colors',
    // States differ only by row background: hover white/4%, pressed white/12%
    // (mode-adaptive via text-primary so it also works on light menu panels).
    'hover:bg-text-primary/[0.04] focus:bg-text-primary/[0.04] focus:outline-none active:bg-text-primary/[0.12]',
    compact && 'border border-border-subtle bg-background-surface',
    variant === 'desktop' && !compact && 'w-[260px]',
    variant === 'mobile' && 'py-2.5',
    className,
  )

  const content = (
    <>
      {Icon ? (
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-default text-text-secondary">
          <Icon className="h-7 w-7" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="font-ds-display text-ds-heading-5 text-text-primary">
            {title}
          </span>
          {badge ? (
            <span className="rounded-md border border-status-success/50 px-1.5 py-0.5 text-[0.6rem] font-black uppercase leading-none text-status-success">
              {badge}
            </span>
          ) : null}
          {external && !to.startsWith('mailto:') ? (
            <ArrowSquareOut className="h-3 w-3 text-text-muted transition-colors group-hover/mmi:text-text-secondary" />
          ) : null}
        </span>
        {description ? (
          // Plain string (not twMerge) — the DS text-size and text-color
          // utilities both start with `text-`, and twMerge would drop the color.
          <span
            className={`block text-text-secondary ${variant === 'desktop' ? 'text-ds-body-xs' : 'text-ds-body-sm'}`}
          >
            {description}
          </span>
        ) : null}
      </span>
    </>
  )

  if (external) {
    return (
      <a
        href={to}
        target={to.startsWith('mailto:') ? undefined : '_blank'}
        rel={to.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
        className={rootClassName}
        onClick={onNavigate}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      to={to}
      hash={hash}
      className={rootClassName}
      onClick={onNavigate}
      preload="intent"
    >
      {content}
    </Link>
  )
}
