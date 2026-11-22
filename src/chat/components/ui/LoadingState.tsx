import { PixelSpinner } from '~/components/ds/ui/PixelSpinner'
import type { ReactNode } from 'react'
import './loading-state.css'
export function LoadingState({
  children = 'Loading…',
  inset = false,
  className = '',
}: {
  children?: ReactNode
  inset?: boolean
  className?: string
}) {
  return (
    <div
      className={`ui-loading${inset ? ' ui-loading-inset' : ''} ${className}`}
      role="status"
    >
      <span aria-hidden="true">
        <PixelSpinner className="h-8 w-8" />
      </span>
      <span>{children}</span>
    </div>
  )
}
