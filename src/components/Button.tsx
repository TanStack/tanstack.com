import * as React from 'react'
import { twMerge } from 'tailwind-merge'

export const buttonStyles = [
  'flex items-center gap-1.5 rounded-md px-2 py-1.5',
  'border border-gray-200 dark:border-gray-700',
  'hover:bg-gray-100 dark:hover:bg-gray-800',
  'cursor-pointer transition-colors duration-200 text-xs font-medium',
].join(' ')

type ButtonProps<T extends React.ElementType = 'button'> = {
  as?: T
  children: React.ReactNode
  className?: string
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

export function Button<T extends React.ElementType = 'button'>({
  as,
  children,
  className,
  ...props
}: ButtonProps<T>) {
  const Component = as || 'button'
  return (
    <Component className={twMerge(buttonStyles, className)} {...props}>
      {children}
    </Component>
  )
}
