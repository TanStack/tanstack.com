import * as React from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Editorial page masthead — a large display title with an optional leading mark,
 * a lede, and an optional trailing action. Emphasized words (wrapped in `<em>`)
 * pick up the warm accent with a soft underline.
 *
 * Generalized from the Merch store hero (see `ShopHero`) so any surface — blog,
 * shop, marketing — can share one header treatment. Colors resolve through DS
 * semantic tokens, so it adapts to the current light/dark theme automatically.
 */
export function PageHeader({
  title,
  lede,
  icon,
  actions,
  align = 'left',
  withDivider = false,
  className,
}: {
  title: React.ReactNode
  lede?: React.ReactNode
  /** Leading mark, paired with the title. Defaults to the TanStack brand emblem
   *  — the standard for global (non-library) pages. Pass a custom node to
   *  override it, or `null` to omit the mark entirely. */
  icon?: React.ReactNode
  /** Trailing control (e.g. an RSS link), pinned to the top-right corner. */
  actions?: React.ReactNode
  align?: 'left' | 'center'
  /** Draw a hairline divider beneath the header. */
  withDivider?: boolean
  className?: string
}) {
  const centered = align === 'center'
  // The brand mark is the default so global pages pair the emblem with the page
  // name out of the box; an explicit `icon` (including `null`) opts out.
  const usingBrandMark = icon === undefined
  const mark = usingBrandMark ? (
    <span className="ds-brand-mark" aria-hidden />
  ) : (
    icon
  )

  return (
    <header
      className={twMerge(
        'relative flex flex-col',
        centered && 'items-center text-center',
        withDivider && 'border-b border-border-subtle pb-6',
        className,
      )}
    >
      <h1 className="m-0 font-ds-display font-bold leading-[1.02] tracking-[-0.03em] text-text-primary text-[clamp(var(--text-ds-heading-1),5vw,var(--text-ds-display-md))] [&_em]:relative [&_em]:not-italic [&_em]:text-accent-warm [&_em]:after:absolute [&_em]:after:inset-x-0 [&_em]:after:-bottom-0.5 [&_em]:after:h-[3px] [&_em]:after:rounded-sm [&_em]:after:bg-accent-warm [&_em]:after:opacity-35">
        <span className="inline-flex items-center gap-[0.3em]">
          {usingBrandMark ? <span className="sr-only">TanStack </span> : null}
          {mark}
          <span>{title}</span>
        </span>
      </h1>
      {lede ? (
        <p
          className={twMerge(
            'mt-3.5 max-w-[58ch] text-ds-body-sm leading-[1.55] text-text-secondary opacity-75',
            centered && 'mx-auto',
          )}
        >
          {lede}
        </p>
      ) : null}
      {actions ? <div className="absolute right-0 top-0">{actions}</div> : null}
    </header>
  )
}
