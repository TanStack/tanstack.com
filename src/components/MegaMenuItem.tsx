import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/ArrowSquareOut'
import { IconContext } from '@phosphor-icons/react/dist/lib/context'

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
    'group/mmi flex items-center gap-2.5 rounded-xl py-3 pl-3 pr-4 text-left transition-[background-color,border-radius,box-shadow]',
    // Light mode: an "elevated white" hover — a bright-white row lifted off the
    // glass with a soft shadow + hairline ring. Dark mode keeps the subtle
    // white/4% (pressed 12%) overlay, no shadow/ring. Radius grows to 14px.
    'hover:rounded-[14px] hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-black/5 focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-black/5 focus:outline-none active:bg-white dark:hover:bg-text-primary/[0.04] dark:hover:shadow-none dark:hover:ring-0 dark:focus:bg-text-primary/[0.04] dark:focus:shadow-none dark:focus:ring-0 dark:active:bg-text-primary/[0.12]',
    compact && 'border border-border-subtle bg-background-surface',
    variant === 'desktop' && !compact && 'w-full',
    variant === 'mobile' && 'py-2.5',
    className,
  )

  const content = (
    <>
      {/* Figma "Menu Icon": 44px box (rounded-6) with 6px padding around a
          32px glyph, so the icon reads consistently across rows. `weight=light`
          (via IconContext) thins the Phosphor strokes; custom SVG icons ignore
          it. */}
      {Icon ? (
        <IconContext.Provider value={{ weight: 'light' }}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md">
            <Icon className="h-8 w-8 text-text-secondary group-hover/mmi:text-text-primary group-focus/mmi:text-text-primary group-active/mmi:text-text-primary" />
          </span>
        </IconContext.Provider>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          {/* Rest = neutral tint (Figma neutral/tint/200); brightens to
              text-primary on hover. Plain string (not twMerge) so the DS size
              utility and the color utilities coexist. */}
          <span
            className={`font-ds-display text-ds-heading-5 whitespace-nowrap ${variant === 'mobile' ? 'text-ds-neutral-tint-200' : 'text-text-menu-title'} transition-colors group-hover/mmi:text-text-primary group-active/mmi:text-text-primary`}
          >
            {title}
          </span>
          {badge ? (
            // Neutral status chip — the word carries the meaning, not the color,
            // so it stays consistent with the library hero badge.
            <span className="rounded-md border border-border-subtle bg-background-subtle px-1.5 py-0.5 text-[0.6rem] font-black uppercase leading-none text-text-secondary">
              {badge}
            </span>
          ) : null}
          {external && !to.startsWith('mailto:') ? (
            <ArrowSquareOutIcon className="h-3 w-3 text-text-muted transition-colors group-hover/mmi:text-text-secondary" />
          ) : null}
        </span>
        {description ? (
          // Plain string (not twMerge) — the DS text-size and text-color
          // utilities both start with `text-`, and twMerge would drop the color.
          // Desktop descriptions stay on a single line (`whitespace-nowrap`); the
          // mega-menu panel is `w-max`, so it widens to fit the longest row.
          <span
            className={`block text-text-secondary ${variant === 'desktop' ? 'whitespace-nowrap text-ds-body-xs leading-relaxed' : 'text-ds-body-sm'}`}
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
