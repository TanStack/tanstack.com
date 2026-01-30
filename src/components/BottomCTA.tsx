import * as React from 'react'
import { Link } from '@tanstack/react-router'
import type { LibraryId } from '~/libraries'

type BottomCTAProps = {
  linkProps: {
    to: '/$libraryId/$version/docs'
    params: { libraryId: LibraryId; version?: string }
  }
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
          to={linkProps.to}
          params={{
            ...linkProps.params,
            version: linkProps.params.version ?? 'latest',
          }}
          className={`inline-flex items-center justify-center gap-2 cursor-pointer transition-colors py-2 px-4 text-sm shadow-xs hover:shadow-sm rounded-lg border font-medium bg-blue-600 text-white border-blue-600 hover:bg-blue-700 ${className}`}
        >
          {label}
        </Link>
      </div>
    </div>
  )
}
