import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link } from '@tanstack/react-router'

type LibraryHeroProps = {
  libraryName: string // e.g., "Query"
  gradientFrom: string
  gradientTo: string
  subtitle: React.ReactNode
  description?: React.ReactNode
  cta?: {
    linkProps: React.ComponentProps<typeof Link>
    label: string
    className?: string
  }
  statusBadge?: string
}

export function LibraryHero({
  libraryName,
  gradientFrom,
  gradientTo,
  subtitle,
  description,
  cta,
  statusBadge,
}: LibraryHeroProps) {
  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${gradientFrom} ${gradientTo}`

  return (
    <div className="flex flex-col items-center gap-8 text-center px-4">
      <h1 className="font-black flex gap-3 items-center text-4xl md:text-6xl lg:text-7xl xl:text-8xl uppercase [letter-spacing:-.05em]">
        <span>TanStack</span>
        <span className={twMerge(gradientText)}>{libraryName}</span>
      </h1>
      {statusBadge ? (
        <div
          className={twMerge(
            'text-sm md:text-base font-black lg:text-lg align-super text-white animate-bounce uppercase',
            'dark:text-black bg-black dark:bg-white shadow-xl shadow-black/30 px-2 py-1 rounded-md',
            'leading-none whitespace-nowrap'
          )}
        >
          STATUS: {statusBadge}
        </div>
      ) : null}
      <h2 className="font-bold text-2xl max-w-md md:text-3xl lg:text-5xl lg:max-w-2xl">
        {subtitle}
      </h2>
      {description ? (
        <p className="text opacity-90 max-w-sm lg:text-xl lg:max-w-2xl">
          {description}
        </p>
      ) : null}
      {cta ? (
        <Link
          {...cta.linkProps}
          className={twMerge(
            'inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors',
            cta.className
          )}
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  )
}
