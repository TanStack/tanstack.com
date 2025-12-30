import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type CardProps<T extends React.ElementType = 'div'> = {
  as?: T
  children: React.ReactNode
  className?: string
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

export function Card<T extends React.ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: CardProps<T>) {
  const Component = as || 'div'
  return (
    <Component
      className={twMerge(
        'bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
