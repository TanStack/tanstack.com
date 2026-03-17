import React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { libraries, type LibrarySlim } from '~/libraries'

// Curated promos for sidebar placement — rotates on each render
const sidebarPromos: Array<{
  library: LibrarySlim
  headline: string
  cta: string
}> = libraries
  .filter(
    (lib) =>
      lib.to &&
      lib.id !== 'react-charts' &&
      lib.id !== 'create-tsrouter-app' &&
      lib.id !== 'cli' &&
      lib.id !== 'config' &&
      lib.id !== 'devtools' &&
      lib.id !== 'mcp',
  )
  .map((lib) => ({
    library: lib,
    headline: lib.tagline,
    cta: `Explore ${lib.name.replace('TanStack ', '')}`,
  }))

function useRandomPromos(count: number) {
  const [promos, setPromos] = React.useState(() =>
    sidebarPromos.slice(0, count),
  )

  React.useEffect(() => {
    const shuffled = [...sidebarPromos].sort(() => Math.random() - 0.5)
    setPromos(shuffled.slice(0, count))
  }, [count])

  return promos
}

/**
 * Sidebar placeholder — replaces the old GamVrec1 ad slot.
 * Shows a couple of TanStack library promos in the right rail.
 */
export function GamVrec1({
  adClassName: _adClassName,
  placeholderClassName: _placeholderClassName,
  popupPosition: _popupPosition,
  borderClassName: _borderClassName,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  adClassName?: string
  placeholderClassName?: string
  popupPosition?: 'top' | 'bottom'
  borderClassName?: string
}) {
  const promos = useRandomPromos(2)

  return (
    <div
      {...props}
      className={twMerge('w-[300px] flex flex-col gap-3', props.className)}
    >
      {promos.map((promo) => (
        <Link
          key={promo.library.id}
          to={promo.library.to!}
          className={twMerge(
            'group relative flex flex-col gap-2 p-4 rounded-xl',
            'border border-gray-200 dark:border-gray-800',
            'bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950',
            'hover:border-gray-300 dark:hover:border-gray-700',
            'hover:shadow-sm transition-all duration-200',
            'overflow-hidden',
          )}
        >
          {/* Subtle accent bar */}
          <div
            className={twMerge(
              'absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r',
              promo.library.colorFrom,
              promo.library.colorTo,
              'opacity-60 group-hover:opacity-100 transition-opacity',
            )}
          />
          <div className="flex items-center gap-2">
            <span
              className={twMerge('text-sm font-bold', promo.library.textStyle)}
            >
              {promo.library.name}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
            {promo.headline}
          </p>
          <span
            className={twMerge(
              'text-xs font-semibold',
              promo.library.textStyle,
              'group-hover:underline',
            )}
          >
            {promo.cta} &rarr;
          </span>
        </Link>
      ))}
      <div className="flex justify-center">
        <span className="text-[10px] text-gray-400 dark:text-gray-600">
          TanStack OSS
        </span>
      </div>
    </div>
  )
}

// Disabled ad positions — these return null for now.
// They will be re-enabled when private partner ad campaigns are active.

export function GamHeader(
  _props: React.HTMLAttributes<HTMLDivElement> & {
    adClassName?: string
  },
) {
  return null
}

export function GamFooter(
  _props?: React.HTMLAttributes<HTMLDivElement> & {
    adClassName?: string
    placeholderClassName?: string
    popupPosition?: 'top' | 'bottom'
    borderClassName?: string
    style?: React.CSSProperties
  },
) {
  return null
}

export function GamRightRailSquare() {
  return null
}

export function GamLeftRailSquare() {
  return null
}

// No-ops — the external ad SDK is gone, these are kept for API compat.
export function GamScripts() {
  return null
}

export function GamOnPageChange() {
  // intentional no-op
}
