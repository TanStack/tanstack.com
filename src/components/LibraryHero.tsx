import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link, LinkProps } from '@tanstack/react-router'
import type { Library } from '~/libraries'
import { Button } from '~/ui'

type LibraryHeroProps = {
  project: Library
  cta?: {
    linkProps: LinkProps
    label: string
    className?: string
  }
  actions?: React.ReactNode
}

export function LibraryHero({ project, cta, actions }: LibraryHeroProps) {
  const resolvedName = project.name.replace('TanStack ', '')
  const hasColor =
    project.colorFrom && !project.colorFrom.includes('from-black')
  // For colorless libraries, use a gray-to-black gradient to create contrast with the black TanStack text
  const gradientText = hasColor
    ? `pr-1 inline-block text-transparent bg-clip-text bg-linear-to-r ${project.colorFrom} ${project.colorTo}`
    : 'pr-1 inline-block text-transparent bg-clip-text bg-linear-to-r from-gray-400 to-black dark:from-gray-500 dark:to-white'

  return (
    <div className="flex flex-col items-center gap-8 text-center px-4">
      <h1 className="font-black flex gap-x-3 gap-y-0 items-center text-5xl md:text-6xl lg:text-7xl xl:text-8xl uppercase [letter-spacing:-.05em] flex-wrap justify-center leading-none">
        <span>TanStack</span>
        <span className={twMerge(gradientText, 'relative')}>
          {resolvedName}
          {project.badge ? (
            <div
              className={twMerge(
                'absolute bottom-0 right-0 translate-y-full',
                '[letter-spacing:0] text-sm md:text-base font-black lg:text-lg align-super text-white animate-bounce uppercase',
                'dark:text-black bg-black dark:bg-white shadow-black/30 px-2 py-1 rounded-md',
                'leading-none whitespace-nowrap',
              )}
            >
              {String(project.badge).toUpperCase().trim()}
            </div>
          ) : null}
        </span>
      </h1>
      <h2 className="font-bold text-2xl md:text-4xl max-w-xl xl:max-w-4xl text-balance [letter-spacing:-0.03em]">
        {project.tagline}
      </h2>
      {project.description ? (
        <p className="text opacity-90 max-w-lg xl:max-w-2xl lg:text-base text-balance">
          {project.description}
        </p>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap gap-2 justify-center">{actions}</div>
      ) : cta ? (
        // @ts-expect-error - LinkProps is not assignable to ButtonProps
        <Button
          as={Link}
          {...cta.linkProps}
          className={twMerge('py-2 px-4 text-sm', cta.className)}
        >
          {cta.label}
        </Button>
      ) : null}
    </div>
  )
}
