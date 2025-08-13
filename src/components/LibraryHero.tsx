import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link } from '@tanstack/react-router'
import type { Library } from '~/libraries'

type LibraryHeroProps = {
  project: Library
  cta?: {
    linkProps: React.ComponentProps<typeof Link>
    label: string
    className?: string
  }
  actions?: React.ReactNode
}

export function LibraryHero({ project, cta, actions }: LibraryHeroProps) {
  const resolvedName = project.name.replace('TanStack ', '')
  const gradientText = `pr-1 inline-block text-transparent bg-clip-text bg-linear-to-r ${project.colorFrom} ${project.colorTo}`

  return (
    <div className="flex flex-col items-center gap-8 text-center px-4">
      <h1 className="font-black flex gap-x-3 gap-y-0 items-center text-5xl md:text-6xl lg:text-7xl xl:text-8xl uppercase [letter-spacing:-.05em] flex-wrap justify-center leading-none">
        <span>TanStack</span>
        <span className={twMerge(gradientText)}>{resolvedName}</span>
      </h1>
      {project.badge ? (
        <div
          className={twMerge(
            'text-sm md:text-base font-black lg:text-lg align-super text-white animate-bounce uppercase',
            'dark:text-black bg-black dark:bg-white shadow-xl shadow-black/30 px-2 py-1 rounded-md',
            'leading-none whitespace-nowrap'
          )}
        >
          STATUS: {String(project.badge).toUpperCase()}
        </div>
      ) : null}
      <h2 className="font-bold text-2xl max-w-md md:max-w-lg md:text-4xl lg:max-w-4xl text-balance">
        {project.tagline}
      </h2>
      {project.description ? (
        <p className="text opacity-90 max-w-sm lg:text-xl lg:max-w-2xl">
          {project.description}
        </p>
      ) : null}
      {actions ? (
        <div>{actions}</div>
      ) : cta ? (
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
