import * as React from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * DS Stats Section — a workshop surface (Phase 1).
 *
 * Models the Figma "Stats" component set (node 733:2110) as a two-axis matrix:
 *   - `page`:   'home' (bordered surface cards) | 'hero' / 'library' (borderless inline)
 *   - `layout`: 'landscape' | 'stacked' | 'stacked-landscape'
 *
 * Defined combinations:
 *   home    · landscape          → cards in a row, icon left
 *   home    · stacked            → cards in a column, icon left
 *   home    · stacked-landscape  → cards in a row, icon on top
 *   hero    · landscape          → transparent metrics for the light homepage image
 *   library · stacked            → value/label rows in a column
 *   library · landscape          → value/label metrics on a single line
 *
 * Deliberately PRESENTATIONAL: it takes already-resolved stat values as props
 * so the visual can be workshopped with sample data on `/ds/stats` without
 * wiring the npm/GitHub queries. Live data-fetching wrappers stay in production
 * until a revised version is promoted back.
 */

export type StatsPage = 'hero' | 'home' | 'library' | 'unified'
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
    'rounded-xl corner-squircle border border-border-subtle bg-background-surface p-5',
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

function UnifiedStat({ stat, iconTop }: { stat: StatItem; iconTop: boolean }) {
  const className = twMerge(
    'flex min-w-0 p-5',
    iconTop ? 'flex-col items-start gap-4' : 'items-center gap-4',
  )
  const content = (
    <>
      {stat.icon ? (
        <span className="shrink-0 text-icon-default [&>svg]:size-6">
          {stat.icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block font-ds-display text-ds-heading-2 leading-none text-text-primary">
          <StatValue placeholder={stat.placeholder} valueRef={stat.valueRef}>
            {stat.value}
          </StatValue>
        </span>
        <span className={`mt-2 block ${statLabelClassName}`}>{stat.label}</span>
      </span>
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
          'transition-colors hover:bg-background-subtle',
        )}
      >
        {content}
      </a>
    )
  }

  return <div className={className}>{content}</div>
}

/* ------------------------------------------------------------ library rows -- */

function LibraryStat({ iconTop, stat }: { iconTop: boolean; stat: StatItem }) {
  return (
    <span
      className={twMerge(
        'inline-flex gap-2.5',
        iconTop ? 'flex-col items-start' : 'items-center',
      )}
    >
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

/* --------------------------------------------------------------- hero stats -- */

function HeroStat({
  layout,
  stat,
  onImage,
}: {
  layout: StatsLayout
  stat: StatItem
  onImage?: boolean
}) {
  const isLandscape = layout === 'landscape'

  return (
    <span
      className={twMerge(
        'inline-flex min-w-0 gap-4 md:gap-3.5 xl:gap-4',
        // Over a (light) image the theme-adaptive text is illegible, so force
        // dark ink; otherwise follow the surface via the semantic token.
        onImage ? 'text-gray-900' : 'text-text-primary',
        layout === 'stacked-landscape'
          ? 'flex-col items-start'
          : 'items-center',
        isLandscape && 'max-md:gap-2',
      )}
    >
      {stat.icon ? (
        <span
          className={twMerge(
            'shrink-0 [&>svg]:size-6 md:[&>svg]:size-5 xl:[&>svg]:size-6',
            onImage ? 'text-gray-700' : 'text-icon-muted',
          )}
        >
          {stat.icon}
        </span>
      ) : null}
      <span
        className={twMerge(
          'flex min-w-0 items-center gap-4 whitespace-nowrap md:gap-3.5 xl:gap-4',
          isLandscape && 'max-md:contents',
        )}
      >
        <span
          className={twMerge(
            'font-ds-mono text-ds-mono-caps-xs font-medium uppercase tracking-[1.75px] md:text-[9.5px] md:tracking-[1.5px] xl:text-ds-mono-caps-xs xl:tracking-[1.75px]',
            onImage ? 'text-gray-700' : 'text-text-secondary',
            isLandscape
              ? 'max-md:text-left max-md:whitespace-normal max-xs:text-[clamp(0.75rem,3.6vw,0.875rem)] max-xs:tracking-normal md:order-last'
              : 'order-last',
          )}
        >
          {stat.label}
        </span>
        <span
          className={twMerge(
            'font-ds-display text-ds-heading-3 font-bold leading-none md:text-[21px] xl:text-ds-heading-3',
            isLandscape && 'max-md:ml-auto max-md:shrink-0 max-md:text-right',
          )}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <StatValue placeholder={stat.placeholder} valueRef={stat.valueRef}>
            {stat.value}
          </StatValue>
        </span>
      </span>
    </span>
  )
}

/* ----------------------------------------------------------------- export -- */

export function StatsSection({
  page = 'home',
  layout = 'landscape',
  stats,
  className,
  onImage = false,
}: {
  page?: StatsPage
  layout?: StatsLayout
  stats: Array<StatItem>
  className?: string
  /** Forces dark ink for legibility when the stats are overlaid on a light
   *  image (the `hero` inline variant). Defaults to theme-adaptive colors. */
  onImage?: boolean
}) {
  if (page === 'unified') {
    const stacked = layout === 'stacked'
    const iconTop = layout === 'stacked-landscape'

    return (
      <div
        className={twMerge(
          'overflow-hidden rounded-xl corner-squircle border border-border-subtle bg-background-surface',
          stacked
            ? 'flex max-w-xs flex-col divide-y divide-border-subtle'
            : 'grid divide-y divide-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0',
          className,
        )}
      >
        {stats.map((stat) => (
          <UnifiedStat key={stat.key} iconTop={iconTop} stat={stat} />
        ))}
      </div>
    )
  }

  if (page === 'hero') {
    return (
      <div
        className={twMerge(
          layout === 'stacked'
            ? 'flex flex-col items-start gap-5'
            : 'flex flex-col items-center gap-4 md:flex-row md:flex-wrap md:justify-center md:gap-x-3.5 md:gap-y-5 xl:gap-x-9',
          layout === 'landscape' && 'max-md:w-full max-md:items-stretch',
          className,
        )}
      >
        {stats.map((stat) => (
          <HeroStat
            key={stat.key}
            layout={layout}
            stat={stat}
            onImage={onImage}
          />
        ))}
      </div>
    )
  }

  if (page === 'library') {
    const isRow = layout !== 'stacked'
    const iconTop = layout === 'stacked-landscape'
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
          <LibraryStat key={stat.key} iconTop={iconTop} stat={stat} />
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
