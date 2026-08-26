import { twMerge } from 'tailwind-merge'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'
  | 'teal'
  | 'orange'

type BadgeProps = {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-background-subtle text-text-secondary',
  success: 'bg-status-success-bg text-text-success',
  warning: 'bg-status-warning-bg text-text-warning',
  error: 'bg-status-error-bg text-text-error',
  info: 'bg-status-info-bg text-text-info',
  purple:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  orange:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
