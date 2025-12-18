import { twMerge } from 'tailwind-merge'
import { Fan } from 'lucide-react'

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <Fan
      className={twMerge(
        'animate-spin text-gray-900 dark:text-white text-2xl',
        className,
      )}
      aria-label="Loading"
    />
  )
}
