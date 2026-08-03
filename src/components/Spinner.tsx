import { twMerge } from 'tailwind-merge'
import { CircleNotchIcon } from '@phosphor-icons/react'

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <CircleNotchIcon
      className={twMerge(
        'animate-spin text-gray-900 dark:text-white text-2xl',
        className,
      )}
      aria-label="Loading"
    />
  )
}
