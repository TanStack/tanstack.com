import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type ButtonGroupProps = {
  children: React.ReactNode
  className?: string
}

export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div
      className={twMerge(
        'inline-flex items-stretch overflow-hidden rounded-md',
        'border border-border-default',
        '[&>*]:border-0! [&>*+*]:border-l! [&>*+*]:border-border-default!',
        'bg-background-surface text-text-primary',
        'shadow-sm',
        '[&>[aria-pressed=true]]:bg-text-primary [&>[aria-pressed=true]]:text-background-default [&>[aria-pressed=true]]:shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
