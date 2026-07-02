import { twMerge } from 'tailwind-merge'
import { CircleNotch } from '@phosphor-icons/react'

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <CircleNotch
      className={twMerge(
        'animate-spin text-gray-900 dark:text-white text-2xl',
        className,
      )}
      aria-label="Loading"
    />
  )
}
