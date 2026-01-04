import * as React from 'react'
import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { Button } from './Button'

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
        <Button
          as={Link}
          {...linkProps}
          className={`py-2 px-4 text-sm shadow-xs hover:shadow-sm ${className}`}
        >
          {label}
        </Button>
      </div>
    </div>
  )
}
