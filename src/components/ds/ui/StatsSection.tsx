import * as React from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * DS Stats Section — a workshop surface (Phase 1).
 *
 * Models the Figma "Stats" component set (node 733:2110) as a two-axis matrix:
 *   - `page`:   'home' (bordered surface cards) | 'library' (borderless inline)
 *   - `layout`: 'landscape' | 'stacked' | 'stacked-landscape'
 *
 * Defined combinations:
 *   home    · landscape          → cards in a row, icon left
 *   home    · stacked            → cards in a column, icon left
 *   home    · stacked-landscape  → cards in a row, icon on top
 *   library · stacked            → value/label rows in a column
 *   library · landscape          → value/label metrics on a single line
 *
 * Deliberately PRESENTATIONAL: it takes already-resolved stat values as props
 * so the visual can be workshopped with sample data on `/ds/stats` without
 * wiring the npm/GitHub queries. Live data-fetching wrappers stay in production
 * until a revised version is promoted back.
 */

export type StatsPage = 'home' | 'library'
export type StatsLayout = 'landscape' | 'stacked' | 'stacked-landscape'

export type StatItem = {
  /** Stable key for React lists. */
  key: string
  /** Pre-formatted display value, e.g. "2.2B" or "65,395,147". */
  value: string
  /** Caption beside/beneath the value. */
  label: string
  /** Leading (or, for stacked-landscape, top) icon. */
  icon?: React.ReactNode
  /** Reserves horizontal space so async values don't shift layout. */
  placeholder?: string
  /** Optional link target. Home cards render as a link; library rows do not. */
  href?: string
  /** Open `href` in a new tab (external URLs). */
  external?: boolean
  /**
   * Attaches to the value's text node so a live counter hook (e.g.
   * useNpmDownloadCounter) can animate it in place after mount.
   */
  valueRef?: React.RefCallback<HTMLSpanElement>
}

// The DS mono-caps label treatment (mirrors the Eyebrow component's base role).
// Applied as a static string — never through twMerge with a color — so the
// custom `text-ds-mono-caps` size isn't dropped alongside the color utility.
const statLabelClassName =
  'font-ds-mono text-ds-mono-caps uppercase text-text-secondary'

/**
 * Reserves the value's footprint with an invisible placeholder so numbers can
 * stream in without reflow.
 */
function StatValue({
  placeholder,
  valueRef,
  children,
}: {
  placeholder?: string
  valueRef?: React.RefCallback<HTMLSpanElement>
  children: React.ReactNode
}) {
  const value = <span ref={valueRef}>{children}</span>

  if (!placeholder) return value

  return (
    <span className="inline-grid [&>*]:col-start-1 [&>*]:row-start-1">
      <span className="invisible" aria-hidden>
        {placeholder}
      </span>
      {value}
    </span>
  )
}

/* --------------------------------------------------------------- home cards -- */

function HomeStatCard({ stat, iconTop }: { stat: StatItem; iconTop: boolean }) {
  const className = twMerge(
    'rounded-xl border border-border-subtle bg-background-surface p-5',
    iconTop ? 'flex flex-col items-start gap-4' : 'flex items-center gap-4',
  )

  const body = (
    <>
      {stat.icon ? (
        <span className="shrink-0 text-icon-default [&>svg]:size-6">
          {stat.icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="font-ds-display text-ds-heading-2 leading-none text-text-primary">
          <StatValue placeholder={stat.placeholder} valueRef={stat.valueRef}>
            {stat.value}
          </StatValue>
        </div>
        <div className={`mt-2 ${statLabelClassName}`}>{stat.label}</div>
      </div>
    </>
  )

  if (stat.href) {
    return (
      <a
        href={stat.href}
        target={stat.external ? '_blank' : undefined}
        rel={stat.external ? 'noreferrer' : undefined}
        className={twMerge(
          className,
          'transition-colors hover:border-border-strong hover:bg-background-subtle',
        )}
      >
        {body}
      </a>
    )
  }

  return <div className={className}>{body}</div>
}

/* ------------------------------------------------------------ library rows -- */

function LibraryStat({ stat }: { stat: StatItem }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {stat.icon ? (
        <span className="shrink-0 text-icon-muted [&>svg]:size-[18px]">
          {stat.icon}
        </span>
      ) : null}
      <span
        className="font-ds-display text-lg font-bold leading-none text-text-primary"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <StatValue placeholder={stat.placeholder} valueRef={stat.valueRef}>
          {stat.value}
        </StatValue>
      </span>
      <span className={statLabelClassName}>{stat.label}</span>
    </span>
  )
}

/* ----------------------------------------------------------------- export -- */

export function StatsSection({
  page = 'home',
  layout = 'landscape',
  stats,
  className,
}: {
  page?: StatsPage
  layout?: StatsLayout
  stats: Array<StatItem>
  className?: string
}) {
  if (page === 'library') {
    // stacked-landscape isn't a defined library combination; treat it as a row.
    const isRow = layout !== 'stacked'
    return (
      <div
        className={twMerge(
          isRow
            ? 'flex flex-wrap items-center gap-x-8 gap-y-3'
            : 'flex flex-col items-start gap-3',
          className,
        )}
      >
        {stats.map((stat) => (
          <LibraryStat key={stat.key} stat={stat} />
        ))}
      </div>
    )
  }

  const iconTop = layout === 'stacked-landscape'
  const groupClassName =
    layout === 'stacked'
      ? 'flex max-w-xs flex-col gap-4'
      : 'grid gap-4 sm:grid-cols-3'

  return (
    <div className={twMerge(groupClassName, className)}>
      {stats.map((stat) => (
        <HomeStatCard key={stat.key} stat={stat} iconTop={iconTop} />
      ))}
    </div>
  )
}
