import * as React from 'react'
import { twMerge } from 'tailwind-merge'

export const buttonStyles = [
  'flex items-center gap-1.5 rounded-md px-2 py-1.5',
  'border border-gray-200 dark:border-gray-700',
  'hover:bg-gray-100 dark:hover:bg-gray-800',
  'cursor-pointer transition-colors duration-200 text-xs font-medium',
].join(' ')

type ButtonOwnProps<TElement extends React.ElementType = 'button'> = {
  as?: TElement
  children: React.ReactNode
  className?: string
}

type ButtonProps<TElement extends React.ElementType = 'button'> =
  ButtonOwnProps<TElement> &
    Omit<
      React.ComponentPropsWithoutRef<TElement>,
      keyof ButtonOwnProps<TElement>
    >

type ButtonComponent = <TElement extends React.ElementType = 'button'>(
  props: ButtonProps<TElement>,
) => React.ReactNode

export const Button: ButtonComponent = ({
  as,
  children,
  className,
  ...props
}) => {
  const Component = as || 'button'
  return React.createElement(
    Component,
    { className: twMerge(buttonStyles, className), ...props },
    children,
  )
}
