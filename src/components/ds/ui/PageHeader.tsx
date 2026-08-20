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
  align = 'left',
  withDivider = false,
  className,
}: {
  title: React.ReactNode
  lede?: React.ReactNode
  align?: 'left' | 'center'
  /** Draw a hairline divider beneath the header. */
  withDivider?: boolean
  className?: string
}) {
  const centered = align === 'center'

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
          <span className="sr-only">TanStack </span>
          <span className="ds-brand-mark" aria-hidden />
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
    </header>
  )
}
