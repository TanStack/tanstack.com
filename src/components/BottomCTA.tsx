import * as React from 'react'
import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'

type BottomCTAProps = {
  linkProps: Omit<LinkProps, 'className' | 'children'>
  label?: string
  className?: string
}

export function BottomCTA({
  linkProps,
  label = 'Get Started!',
  className,
}: BottomCTAProps) {
  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="font-extrabold text-xl lg:text-2xl">
        Wow, you've come a long way!
      </div>
      <div className="italic font-sm opacity-70">
        Only one thing left to do...
      </div>
      <div>
        <Link
          {...linkProps}
          className={twMerge(
            'inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors',
            className
          )}
        >
          {label}
        </Link>
      </div>
    </div>
  )
}
