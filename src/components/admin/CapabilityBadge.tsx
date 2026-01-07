import { twMerge } from 'tailwind-merge'
import type { Capability } from '~/db/types'

type CapabilityBadgeProps = {
  capability: Capability | string
  className?: string
}

const capabilityStyles: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  disableAds:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  builder: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  feed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'moderate-feedback':
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'moderate-showcases':
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

const defaultStyle =
  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'

export function CapabilityBadge({
  capability,
  className,
}: CapabilityBadgeProps) {
  const style = capabilityStyles[capability] || defaultStyle

  return (
    <span
      className={twMerge(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        style,
        className,
      )}
    >
      {capability}
    </span>
  )
}
