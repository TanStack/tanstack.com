import { TbFidgetSpinner } from 'react-icons/tb'
import { twMerge } from 'tailwind-merge'

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <TbFidgetSpinner
      className={twMerge(
        'animate-spin text-gray-900 dark:text-white text-2xl',
        className,
      )}
      aria-label="Loading"
    />
  )
}
