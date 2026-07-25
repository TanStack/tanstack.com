import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ArrowSquareOut } from '@phosphor-icons/react'

type IconComponent = React.ComponentType<{ className?: string }>

export interface MegaMenuItemProps {
  /** Leading icon — a plain glyph, top-aligned with the title (no border/box). */
  icon?: IconComponent
  title: React.ReactNode
  description?: React.ReactNode
  /** Internal route or external (http/mailto) URL. */
  to: string
  hash?: string
  badge?: string
  /** When set, the row renders as a button running this instead of navigating. */
  onSelect?: () => void
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
 * pressed states. Modeled on the Figma "Mega Menu Item" component: a plain
 * leading icon top-aligned with the title (no bordered square), Bricolage-bold
 * title (heading-5), muted body-xs description, and a mode-adaptive overlay on
 * hover/press. Used by the site Navbar and shown in the design system at
 * /ds/navbar.
 */
export function MegaMenuItem({
  icon: Icon,
  title,
  description,
  to,
  hash,
  badge,
  onSelect,
  onNavigate,
  variant = 'desktop',
  compact,
  className,
}: MegaMenuItemProps) {
  const external = isExternal(to)

  const rootClassName = twMerge(
    // Figma "Mege menu list item" (node 407:659): gap 10px, pl 12 / pr 16 /
    // py 12, radius 12px (14px on hover). Icon box + text vertically centered.
    'group/mmi flex items-center gap-2.5 rounded-xl py-3 pl-3 pr-4 text-left transition-[background-color,border-radius]',
    // States differ only by row background: hover white/4% + radius 14px,
    // pressed white/12% (mode-adaptive via text-primary so it also works on
    // light menu panels).
    'hover:rounded-[14px] hover:bg-text-primary/[0.04] focus:bg-text-primary/[0.04] focus:outline-none active:bg-text-primary/[0.12]',
    compact && 'border border-border-subtle bg-background-surface',
    variant === 'desktop' && !compact && 'w-[330px]',
    variant === 'mobile' && 'py-2.5',
    className,
  )

  const content = (
    <>
      {/* Figma "Menu Icon": 44px box (rounded-6) with 6px padding around a
          32px glyph, so the icon reads consistently across rows. */}
      {Icon ? (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md">
          <Icon className="h-8 w-8 text-text-secondary" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          {/* Rest = neutral tint (Figma neutral/tint/200); brightens to
              text-primary on hover. Plain string (not twMerge) so the DS size
              utility and the color utilities coexist. */}
          <span className="font-ds-display text-ds-heading-5 whitespace-nowrap text-text-menu-title transition-colors group-hover/mmi:text-text-primary group-active/mmi:text-text-primary">
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
          // Desktop rows never wrap the subtext (keeps the column balanced);
          // descriptions are copy-constrained to fit the 330px item width.
          <span
            className={`block text-text-secondary ${variant === 'desktop' ? 'text-ds-body-xs whitespace-nowrap' : 'text-ds-body-sm'}`}
          >
            {description}
          </span>
        ) : null}
      </span>
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        className={rootClassName}
        onClick={() => {
          onSelect()
          onNavigate?.()
        }}
      >
        {content}
      </button>
    )
  }

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
