import { twMerge } from 'tailwind-merge'
import { Badge } from '~/components/ds/ui'
import type { LibrarySlim } from '~/libraries'

type LibraryBadge = NonNullable<LibrarySlim['badge']>

const libraryBadgeVariants = {
  new: 'success',
  fresh: 'success',
  soon: 'default',
  alpha: 'info',
  beta: 'warning',
  RC: 'warning',
} as const

export function LibraryStatusBadge({
  badge,
  className,
}: {
  badge: LibraryBadge
  className?: string
}) {
  return (
    <Badge
      variant={libraryBadgeVariants[badge]}
      rounded="md"
      className={twMerge(
        'font-ds-mono text-ds-mono-caps-xs uppercase',
        className,
      )}
    >
      {badge}
    </Badge>
  )
}
