import { twMerge } from 'tailwind-merge'

type StatusBadgeProps = {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  // Approval statuses
  approved:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',

  // Active/Inactive
  active:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',

  // Boolean states
  true: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  false: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',

  // OAuth providers
  github: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  google: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}

const defaultStyle =
  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status.toLowerCase()] || defaultStyle

  return (
    <span
      className={twMerge(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        style,
        className,
      )}
    >
      {status}
    </span>
  )
}
